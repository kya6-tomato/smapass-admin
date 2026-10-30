import { randomBytes, randomUUID } from "node:crypto";
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
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export function parseMockScenario(value: string | undefined): MockScenario {
  return (MOCK_SCENARIOS as readonly string[]).includes(value ?? "")
    ? (value as MockScenario)
    : "default";
}

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

    async createRecord(token, _req, idempotencyKey) {
      requireToken(token);
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
