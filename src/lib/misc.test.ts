import { describe, expect, it } from "vitest";
import { DEFAULT_POLL_INTERVAL_MS, DEFAULT_POLL_TIMEOUT_MS, getPollingConfig } from "@/config";
import { toDeviceView } from "./device";
import type { Device } from "./go-client/types";
import { FALLBACK_MESSAGE, messageForCode } from "./messages";

describe("FR-P02 端末の表示", () => {
  it("基準2：表示用の端末情報にはIMEIなどを含めない", () => {
    const fromGo = { deviceId: "dev_1", displayName: "デモ端末", imei: "356938035643809" } as Device;
    expect(toDeviceView(fromGo)).toEqual({ deviceId: "dev_1", displayName: "デモ端末" });
  });
});

describe("FR-P05 基準4 問い合わせの設定", () => {
  it("既定は3秒ごと、最大2分（案）", () => {
    expect(DEFAULT_POLL_INTERVAL_MS).toBe(3_000);
    expect(DEFAULT_POLL_TIMEOUT_MS).toBe(120_000);
    expect(getPollingConfig({} as NodeJS.ProcessEnv)).toEqual({ intervalMs: 3_000, timeoutMs: 120_000 });
  });

  it("不正な値は既定に戻す", () => {
    const env = { POLL_INTERVAL_MS: "-1", POLL_TIMEOUT_MS: "abc" } as unknown as NodeJS.ProcessEnv;
    expect(getPollingConfig(env)).toEqual({ intervalMs: 3_000, timeoutMs: 120_000 });
  });
});

describe("エラーの文言", () => {
  it("FR-P01 基準2：ログイン失敗はどちらが違うかを言わない", () => {
    expect(messageForCode("invalid_credentials")).toBe("IDまたはパスワードが違います");
  });

  it("知らないコードは共通の文言にする（Goの message は出さない）", () => {
    expect(messageForCode("something_new")).toBe(FALLBACK_MESSAGE);
  });
});
