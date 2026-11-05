import { describe, expect, it } from "vitest";
import { QR_CODE_QUERY_PARAM } from "@/config";
import { checkCode } from "./device-session";
import { describeCameraError, extractCodeFromQrText } from "./qr";

describe("FR-P03 基準5 QRの中身 → コード", () => {
  it("基準5：URLでない文字列は、前後の空白を除いてそのままコードにする", () => {
    expect(extractCodeFromQrText("123456")).toBe("123456");
    expect(extractCodeFromQrText("  AB-12 cd \n")).toBe("AB-12 cd");
    expect(extractCodeFromQrText("AB:12")).toBe("AB:12"); // 「://」のないコロンはURLにしない
  });

  it("基準5：URLなら、設定したクエリパラメータの値をコードにする", () => {
    expect(extractCodeFromQrText(`https://example.com/pair?${QR_CODE_QUERY_PARAM}=123456`)).toBe("123456");
    expect(extractCodeFromQrText("https://example.com/pair?x=1&code=AB%2012&y=2")).toBe("AB 12");
    expect(extractCodeFromQrText("  smapass://pair?code=777 ")).toBe("777"); // アプリ独自のスキームも同じ
  });

  it("基準5：パラメータ名は引数で変えられる（設定はsrc/config.ts）", () => {
    expect(extractCodeFromQrText("https://example.com/?c=9&code=1", "c")).toBe("9");
    expect(extractCodeFromQrText("https://example.com/?code=1", "c")).toBeNull();
  });

  it("基準5：URLなのにコードがない・読めないときは null（Goには送らない）", () => {
    expect(extractCodeFromQrText("https://example.com/pair")).toBeNull();
    expect(extractCodeFromQrText("https://example.com/pair?code=")).toBeNull();
    expect(extractCodeFromQrText("https://example.com/pair?code=%20")).toBeNull();
    expect(extractCodeFromQrText("https://")).toBeNull();
  });

  it("基準5：空・空白だけ・文字列でないものは null", () => {
    expect(extractCodeFromQrText("")).toBeNull();
    expect(extractCodeFromQrText("   ")).toBeNull();
    expect(extractCodeFromQrText(undefined)).toBeNull();
    expect(extractCodeFromQrText(123456)).toBeNull();
  });

  it("基準5：取り出したコードは手入力と同じ検査（checkCode）に渡せる", () => {
    const extracted = extractCodeFromQrText("https://example.com/pair?code=%20123456%20");
    expect(extracted).toBe("123456");
    expect(checkCode(extracted)).toEqual({ ok: true, code: "123456" });
  });
});

describe("FR-P03 基準5 カメラのエラー → メッセージ", () => {
  it("基準5：許可なし・カメラなし・使用中・その他で別々の案内を出し、どれも手入力を案内する", () => {
    const messages = [
      describeCameraError({ name: "NotAllowedError" }),
      describeCameraError({ name: "NotFoundError" }),
      describeCameraError({ name: "NotReadableError" }),
      describeCameraError(new Error("boom")),
    ];
    expect(new Set(messages).size).toBe(4);
    for (const m of messages) expect(m).toContain("手入力");
    expect(describeCameraError({ name: "SecurityError" })).toBe(messages[0]);
    expect(describeCameraError(null)).toBe(messages[3]);
  });
});
