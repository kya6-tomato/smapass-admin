import { describe, expect, it } from "vitest";
import { formatJstLocal, jstLocalToUtcIso } from "./time";

// FR-P04「日時の扱い」：Goへは UTC・Z付き・秒まで

describe("jstLocalToUtcIso", () => {
  it("日本時間を9時間戻したUTCにし、Z付き・秒までにする", () => {
    expect(jstLocalToUtcIso("2026-11-10T14:30")).toBe("2026-11-10T05:30:00Z");
  });

  it("日付をまたぐ場合も正しく変換する", () => {
    expect(jstLocalToUtcIso("2026-11-10T08:00")).toBe("2026-11-09T23:00:00Z");
    expect(jstLocalToUtcIso("2026-01-01T00:00")).toBe("2025-12-31T15:00:00Z");
  });

  it("ミリ秒や +09:00 を含まない", () => {
    const iso = jstLocalToUtcIso("2026-11-10T14:30");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("存在しない日時や形式違いは null", () => {
    expect(jstLocalToUtcIso("2026-02-30T10:00")).toBeNull();
    expect(jstLocalToUtcIso("2026-11-10 14:30")).toBeNull();
    expect(jstLocalToUtcIso("2026-11-10T14:30:00+09:00")).toBeNull();
    expect(jstLocalToUtcIso("")).toBeNull();
  });
});

describe("formatJstLocal", () => {
  it("確認画面用に日本時間と分かる形で表示する", () => {
    expect(formatJstLocal("2026-11-10T14:30")).toBe("2026/11/10 14:30（日本時間）");
  });
});
