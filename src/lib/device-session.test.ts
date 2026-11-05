import { describe, expect, it } from "vitest";
import { DEVICE_CODE_MAX_LENGTH } from "@/config";
import {
  checkCode,
  DEFAULT_CODE_DEVICE_NAME,
  isWriteWindowClosed,
  parseTargetCookie,
  serializeTarget,
  toTargetDevice,
  type TargetDevice,
} from "./device-session";
import { GoApiError } from "./go-client/errors";
import { createMockClient, MOCK_CODES, MOCK_MAX_WRONG_ATTEMPTS, MOCK_DEMO_ACCOUNT } from "./go-client/mock";
import { messageForCode } from "./messages";
import { flowReducer, INITIAL_FLOW } from "./record-flow";
import { formatRemaining, remainingMs } from "./time";

const NOW = Date.parse("2026-11-10T05:30:00Z");
const target = (writableUntil: string | null): TargetDevice => ({
  deviceId: "dev_x",
  displayName: "端末",
  writableUntil,
});

const freshStore = () => ({ tokens: new Set<string>(), records: new Map(), idempotency: new Map() });
async function loggedIn(scenario: Parameters<typeof createMockClient>[0] = "default") {
  const client = createMockClient(scenario, freshStore());
  const { token } = await client.login(MOCK_DEMO_ACCOUNT);
  return { client, token };
}

describe("FR-P03 基準1 コードの手入力", () => {
  it("基準1：前後の空白を除いてGoに送り、桁数や文字の種類は判定しない", () => {
    expect(checkCode("  AB-12 cd ")).toEqual({ ok: true, code: "AB-12 cd" });
    expect(checkCode("1")).toEqual({ ok: true, code: "1" });
    expect(checkCode("あいう")).toEqual({ ok: true, code: "あいう" });
  });

  it("基準1：空・空白だけ・長すぎる入力だけを弾く", () => {
    expect(checkCode("")).toEqual({ ok: false, reason: "empty" });
    expect(checkCode("   ")).toEqual({ ok: false, reason: "empty" });
    expect(checkCode(undefined)).toEqual({ ok: false, reason: "empty" });
    expect(checkCode("a".repeat(DEVICE_CODE_MAX_LENGTH + 1))).toEqual({ ok: false, reason: "too_long" });
  });

  it("基準1：成功するとFR-P02と同じ形（端末IDと表示名）で記録先になる。表示名が無ければ既定の名前", async () => {
    const { client, token } = await loggedIn();
    const res = await client.createDeviceSession(token, { code: MOCK_CODES.valid });
    expect(toTargetDevice(res)).toEqual({
      deviceId: res.deviceId,
      displayName: res.displayName,
      writableUntil: res.writableUntil,
    });
    expect(toTargetDevice({ deviceId: "d", writableUntil: "2026-11-10T05:35:00Z" }).displayName).toBe(
      DEFAULT_CODE_DEVICE_NAME,
    );
  });

  it("基準1：端末の特定につながる余計な項目は画面用の値に含めない", () => {
    const fromGo = { deviceId: "d", displayName: "x", writableUntil: "2026-11-10T05:35:00Z", imei: "356938035643809" };
    expect(Object.keys(toTargetDevice(fromGo)).sort()).toEqual(["deviceId", "displayName", "writableUntil"]);
  });
});

describe("FR-P03 基準2 コードのエラーは別々のメッセージ", () => {
  it("基準2：期限切れ・使用済み・誤りがそれぞれ別のコードと文言になる", async () => {
    const { client, token } = await loggedIn();
    const codes = [
      [MOCK_CODES.expired, "code_expired", "コードの有効期限が切れています"],
      [MOCK_CODES.used, "code_used", "このコードはすでに使われています"],
      ["not-a-code", "code_invalid", "コードが正しくありません"],
    ] as const;
    const seen = new Set<string>();
    for (const [code, expectedCode, text] of codes) {
      const err = await client.createDeviceSession(token, { code }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(GoApiError);
      expect((err as GoApiError).code).toBe(expectedCode);
      expect(messageForCode((err as GoApiError).code)).toBe(text);
      seen.add(text);
    }
    expect(seen.size).toBe(3);
  });
});

describe("FR-P03 基準3 回数制限はGo側で判定する", () => {
  it("基準3：モックのGoは同じ誤りコードの6回目から too_many_attempts を返す", async () => {
    const { client, token } = await loggedIn();
    for (let i = 0; i < MOCK_MAX_WRONG_ATTEMPTS; i++) {
      await expect(client.createDeviceSession(token, { code: "wrong" })).rejects.toMatchObject({
        code: "code_invalid",
      });
    }
    await expect(client.createDeviceSession(token, { code: "wrong" })).rejects.toMatchObject({
      status: 429,
      code: "too_many_attempts",
    });
    expect(messageForCode("too_many_attempts")).toBe(
      "入力回数の上限に達しました。アプリで新しいコードを表示してください",
    );
  });

  it("基準3：サイト側のチェックは回数を持たない（同じ入力を何度でも同じ結果で通す）", () => {
    for (let i = 0; i < 20; i++) expect(checkCode("wrong")).toEqual({ ok: true, code: "wrong" });
  });
});

describe("FR-P03 基準4 書き込みできる残り時間", () => {
  it("基準4：writableUntil までの残りを計算し、m:ss で表示する（秒は切り上げ）", () => {
    expect(remainingMs("2026-11-10T05:35:00Z", NOW)).toBe(300_000);
    expect(formatRemaining(300_000)).toBe("5:00");
    expect(formatRemaining(272_001)).toBe("4:33");
    expect(formatRemaining(9_000)).toBe("0:09");
    expect(formatRemaining(0)).toBe("0:00");
  });

  it("基準4：期限を過ぎたら残りは0。Zが付いていない時刻は読めないので null", () => {
    expect(remainingMs("2026-11-10T05:29:00Z", NOW)).toBe(0);
    expect(remainingMs("2026-11-10T14:35:00+09:00", NOW)).toBeNull();
    expect(remainingMs("2026-11-10T05:35:00", NOW)).toBeNull();
  });

  it("基準4：時間切れになったら閉じた扱い。デモ端末（期限なし）は閉じない", () => {
    const t = target("2026-11-10T05:35:00Z");
    expect(isWriteWindowClosed(t, NOW)).toBe(false);
    expect(isWriteWindowClosed(t, NOW + 299_999)).toBe(false);
    expect(isWriteWindowClosed(t, NOW + 300_000)).toBe(true);
    expect(isWriteWindowClosed(target(null), NOW + 10 ** 9)).toBe(false);
    expect(isWriteWindowClosed(null, NOW)).toBe(false);
  });

  it("基準4：Goが device_session_expired を返したら、手元の時計が残っていても閉じた扱い", () => {
    expect(isWriteWindowClosed(target("2026-11-10T05:35:00Z"), NOW, true)).toBe(true);
  });

  it("基準4：画面を開き直したとき、Cookieの記録先は期限内だけ復元する", () => {
    const t = target("2026-11-10T05:35:00Z");
    expect(parseTargetCookie(serializeTarget(t), NOW)).toEqual(t);
    expect(parseTargetCookie(serializeTarget(t), NOW + 300_000)).toBeNull();
    expect(parseTargetCookie("{broken", NOW)).toBeNull();
    expect(parseTargetCookie(JSON.stringify({ deviceId: "d" }), NOW)).toBeNull();
    expect(parseTargetCookie(undefined, NOW)).toBeNull();
  });

  it("基準4：モックのGoは、期限を過ぎた端末への送信を device_session_expired（403）で断る", async () => {
    const { client, token } = await loggedIn();
    const session = await client.createDeviceSession(token, { code: MOCK_CODES.shortSession });
    const req = {
      deviceId: session.deviceId,
      recordType: "inspection" as const,
      workedAt: "2026-11-10T05:30:00Z",
      content: { inspectionResult: "ok" },
    };
    await expect(client.createRecord(token, req, "k1")).resolves.toMatchObject({ status: "pending" });

    const realNow = Date.now;
    Date.now = () => realNow() + 60_000;
    try {
      await expect(client.createRecord(token, req, "k2")).rejects.toMatchObject({
        status: 403,
        code: "device_session_expired",
      });
    } finally {
      Date.now = realNow;
    }
    expect(messageForCode("device_session_expired")).toBe("書き込みできる時間が終わりました");
  });

  it("基準4：送信が時間切れで断られたら、記録を作らずに同じ冪等キーのまま確認画面へ戻る", () => {
    let state = flowReducer(INITIAL_FLOW, { type: "confirm", idempotencyKey: "key-1" });
    state = flowReducer(state, { type: "send" });
    state = flowReducer(state, { type: "sessionExpired" });
    expect(state.phase).toBe("confirming");
    expect(state.idempotencyKey).toBe("key-1");
    expect(state.recordId).toBeNull();
  });
});
