import { randomBytes, randomUUID } from "node:crypto";
import { MOCK_WRITABLE_MS } from "@/config";
import { GoApiError } from "./errors";
import type { GoClient, MaintenanceRecordStatus, RecordStatus } from "./types";

/**
 * Goの代わりに動くモック（docs/api-contract.md と同じ形で応答する）。
 * USE_API_MOCK=true のときだけ使う。E2Eテストでは cookie「mock_scenario」で失敗や遅延を再現する。
 */

/** モックのデモアカウント。本物のIDとパスワードはGo側が持つ */
export const MOCK_DEMO_ACCOUNT = { partnerId: "demo-repair", password: "demo-password" } as const;

export const MOCK_SCENARIOS = [
  "default", // 1回目の問い合わせで submitted、2回目で confirmed
  "device_missing", // デモ端末が取れない
  "submit_error", // 記録の送信で通信エラー
  "status_slow", // 4回目の問い合わせで confirmed
  "status_failed", // チェーンへの記録に失敗する
  "status_stuck", // いつまでも pending のまま
  "submit_session_expired", // 記録の送信が device_session_expired（403）になる（FR-P03 基準4）
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export function parseMockScenario(value: string | undefined): MockScenario {
  return (MOCK_SCENARIOS as readonly string[]).includes(value ?? "")
    ? (value as MockScenario)
    : "default";
}

/**
 * 手入力コードの振る舞い（FR-P03）。本物のコードの形式（桁数・文字）は未決なので、モックだけの取り決め。
 * ここに無いコードは code_invalid。同じ誤りコードを MOCK_MAX_WRONG_ATTEMPTS 回入れたあとは too_many_attempts。
 * 成功コードは何度でも使える（並列のE2Eで使い回すため。本物は1回限り）。
 */
export const MOCK_CODES = {
  valid: "123456", // 成功。書き込みは MOCK_WRITABLE_MS（5分）
  shortSession: "000004", // 成功。書き込みは MOCK_SHORT_WRITABLE_MS（6秒）。時間切れのE2E用
  expired: "000001", // code_expired
  used: "000002", // code_used
  tooMany: "000003", // too_many_attempts
} as const;
/** 時間切れを素早く試すための書き込み時間 */
export const MOCK_SHORT_WRITABLE_MS = 6_000;
/** モックが誤りコードの何回目から too_many_attempts にするか（案：1コード5回で失効） */
export const MOCK_MAX_WRONG_ATTEMPTS = 5;
/** コードで指定できる端末（デモ端末とは別のID） */
export const MOCK_CODE_DEVICE = { deviceId: "dev_5c0de001", displayName: "お客様のスマートフォン" } as const;
/** 時間切れ用コードの端末。valid と別IDにして、並列のテスト同士で期限を上書きし合わないようにする */
export const MOCK_SHORT_DEVICE = { deviceId: "dev_5c0de002", displayName: "お客様のスマートフォン（短時間）" } as const;

type StoredRecord = {
  recordId: string;
  polls: number;
  scenario: MockScenario;
  txHash: string;
};

type MockStore = {
  tokens: Set<string>;
  records: Map<string, StoredRecord>;
  /** 冪等キー → 記録ID。同じキーで2回送られても1件にする */
  idempotency: Map<string, string>;
  /** 端末ID → 書き込める期限（ミリ秒）。コードで指定した端末だけ入る */
  deviceSessions?: Map<string, number>;
  /** 誤りコード → 誤りの回数 */
  codeAttempts?: Map<string, number>;
};

/** 開発サーバーの再読み込みでも消えないよう globalThis に置く */
export function getMockStore(): MockStore {
  const g = globalThis as typeof globalThis & { __partnerMockStore?: MockStore };
  g.__partnerMockStore ??= { tokens: new Set(), records: new Map(), idempotency: new Map() };
  return g.__partnerMockStore;
}

export function createMockClient(scenario: MockScenario = "default", store = getMockStore()): GoClient {
  function requireToken(token: string) {
    if (!store.tokens.has(token)) throw new GoApiError(401, "unauthenticated");
  }

  function statusFor(rec: StoredRecord): RecordStatus {
    switch (rec.scenario) {
      case "status_stuck":
        return "pending";
      case "status_failed":
        return rec.polls >= 1 ? "failed" : "pending";
      case "status_slow":
        return rec.polls >= 4 ? "confirmed" : rec.polls >= 2 ? "submitted" : "pending";
      default:
        return rec.polls >= 2 ? "confirmed" : rec.polls >= 1 ? "submitted" : "pending";
    }
  }

  return {
    async login({ partnerId, password }) {
      if (partnerId !== MOCK_DEMO_ACCOUNT.partnerId || password !== MOCK_DEMO_ACCOUNT.password) {
        throw new GoApiError(401, "invalid_credentials");
      }
      const token = `mock_${randomUUID()}`;
      store.tokens.add(token);
      return { token, expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString() };
    },

    async logout(token) {
      store.tokens.delete(token);
    },

    async getMe(token) {
      requireToken(token);
      return {
        partnerId: MOCK_DEMO_ACCOUNT.partnerId,
        name: "デモ修理店",
        type: "repair_shop",
        hasRegistrationNumber: true,
      };
    },

    async getDemoDevice(token) {
      requireToken(token);
      if (scenario === "device_missing") throw new GoApiError(404, "device_not_found");
      return { deviceId: "dev_7f3a9c21", displayName: "デモ端末" };
    },

    async createDeviceSession(token, { code }) {
      requireToken(token);
      const sessions = (store.deviceSessions ??= new Map());
      const attempts = (store.codeAttempts ??= new Map());
      const grant = (device: { deviceId: string; displayName: string }, ms: number) => {
        const until = Date.now() + ms;
        sessions.set(device.deviceId, until);
        return {
          deviceId: device.deviceId,
          displayName: device.displayName,
          writableUntil: new Date(until).toISOString().replace(/\.\d{3}Z$/, "Z"),
        };
      };
      switch (code) {
        case MOCK_CODES.valid:
          return grant(MOCK_CODE_DEVICE, MOCK_WRITABLE_MS);
        case MOCK_CODES.shortSession:
          return grant(MOCK_SHORT_DEVICE, MOCK_SHORT_WRITABLE_MS);
        case MOCK_CODES.expired:
          throw new GoApiError(410, "code_expired");
        case MOCK_CODES.used:
          throw new GoApiError(409, "code_used");
        case MOCK_CODES.tooMany:
          throw new GoApiError(429, "too_many_attempts");
      }
      const wrong = attempts.get(code) ?? 0;
      if (wrong >= MOCK_MAX_WRONG_ATTEMPTS) throw new GoApiError(429, "too_many_attempts");
      attempts.set(code, wrong + 1);
      throw new GoApiError(400, "code_invalid");
    },

    async createRecord(token, req, idempotencyKey) {
      requireToken(token);
      const until = store.deviceSessions?.get(req.deviceId);
      if (scenario === "submit_session_expired" || (until !== undefined && Date.now() >= until)) {
        throw new GoApiError(403, "device_session_expired");
      }
      if (scenario === "submit_error") throw new GoApiError(0, "network_error");
      const existing = store.idempotency.get(idempotencyKey);
      if (existing) return { recordId: existing, status: "pending" };

      const recordId = `rec_${randomUUID().slice(0, 8)}`;
      store.idempotency.set(idempotencyKey, recordId);
      store.records.set(recordId, {
        recordId,
        polls: 0,
        scenario,
        txHash: `0x${randomBytes(32).toString("hex")}`,
      });
      return { recordId, status: "pending" };
    },

    async getRecordStatus(token, recordId) {
      requireToken(token);
      const rec = store.records.get(recordId);
      if (!rec) throw new GoApiError(404, "record_not_found");
      rec.polls += 1;
      const status = statusFor(rec);
      const res: MaintenanceRecordStatus = { recordId, status };
      if (status === "submitted" || status === "confirmed") {
        res.txHash = rec.txHash;
        res.signerAddress = "0x9a4c3e5b0d7f2a1c8e6b4d2f0a9c7e5b3d1f2a4c";
      }
      if (status === "failed") {
        res.error = { code: "chain_submit_failed", message: "mock: chain submission failed" };
      }
      return res;
    },
  };
}
