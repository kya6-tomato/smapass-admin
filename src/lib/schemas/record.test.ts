import { describe, expect, it } from "vitest";
import { LIMITS } from "@/config";
import { EMPTY_FORM, toApiRequest, validateRecordForm, type RecordFormValues } from "./record";

// 2026-11-10 15:00（日本時間）を「今」とする
const NOW = () => new Date("2026-11-10T06:00:00Z");

const valid: RecordFormValues = {
  ...EMPTY_FORM,
  recordType: "part_replacement",
  workedAt: "2026-11-10T14:30",
  repairArea: "バッテリー",
  parts: [{ name: "バッテリー", origin: "genuine" }],
};

describe("FR-P04 入力の検証", () => {
  it("正しい入力は通る", () => {
    expect(validateRecordForm(valid, NOW).ok).toBe(true);
  });

  it("基準3：記録の種類と作業日時は必須", () => {
    const r = validateRecordForm(EMPTY_FORM, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.recordType).toBe("記録の種類を選んでください");
      expect(r.fieldErrors.workedAt).toBe("作業日時を入力してください");
    }
  });

  it("基準3：修理・部品交換では修理箇所と使用パーツが必須", () => {
    for (const recordType of ["repair", "part_replacement"] as const) {
      const r = validateRecordForm(
        { ...valid, recordType, repairArea: "", parts: [{ name: " ", origin: "genuine" }] },
        NOW,
      );
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.fieldErrors.repairArea).toBeDefined();
        expect(r.fieldErrors.parts).toBeDefined();
      }
    }
  });

  it("基準3：点検では点検結果が必須で、修理箇所とパーツは不要", () => {
    const base = { ...EMPTY_FORM, recordType: "inspection" as const, workedAt: "2026-11-10T14:30" };
    const missing = validateRecordForm(base, NOW);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(Object.keys(missing.fieldErrors)).toEqual(["inspectionResult"]);
    }
    expect(validateRecordForm({ ...base, inspectionResult: "異常なし" }, NOW).ok).toBe(true);
  });

  it("基準4：未来の日時は入れられない", () => {
    const r = validateRecordForm({ ...valid, workedAt: "2026-11-10T15:01" }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.workedAt).toBe("未来の日時は入力できません");
    expect(validateRecordForm({ ...valid, workedAt: "2026-11-10T15:00" }, NOW).ok).toBe(true);
  });

  it(`基準5：メモは${LIMITS.memo}文字まで`, () => {
    expect(validateRecordForm({ ...valid, memo: "あ".repeat(LIMITS.memo) }, NOW).ok).toBe(true);
    const r = validateRecordForm({ ...valid, memo: "あ".repeat(LIMITS.memo + 1) }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.memo).toBe(`メモは${LIMITS.memo}文字以内で入力してください`);
  });

  it("基準2・7：訂正・取り消しはサーバー側の検証でも通らない", () => {
    for (const recordType of ["correction", "revocation"]) {
      const r = validateRecordForm({ ...valid, recordType }, NOW);
      expect(r.ok).toBe(false);
    }
  });

  it("基準7：想定外の形（改ざんされた送信）は通らない", () => {
    expect(validateRecordForm(null, NOW).ok).toBe(false);
    expect(validateRecordForm({ ...valid, parts: "battery" }, NOW).ok).toBe(false);
    expect(validateRecordForm({ ...valid, parts: [{ name: "x", origin: "fake" }] }, NOW).ok).toBe(false);
  });
});

describe("toApiRequest", () => {
  it("日時をUTCにし、空の項目と空のパーツ行は送らない", () => {
    const r = validateRecordForm(
      { ...valid, parts: [{ name: "バッテリー", origin: "genuine" }, { name: "", origin: "compatible" }] },
      NOW,
    );
    if (!r.ok) throw new Error("should be valid");
    expect(toApiRequest("dev_1", r.data)).toEqual({
      deviceId: "dev_1",
      recordType: "part_replacement",
      workedAt: "2026-11-10T05:30:00Z",
      content: { repairArea: "バッテリー", parts: [{ name: "バッテリー", origin: "genuine" }] },
    });
  });

  it("記録ID・ソルト・記録者は送らない（Goが付ける）", () => {
    const r = validateRecordForm({ ...valid, salt: "x", recordId: "y", signer: "z" }, NOW);
    if (!r.ok) throw new Error("should be valid");
    const req = toApiRequest("dev_1", r.data) as Record<string, unknown>;
    expect(req).not.toHaveProperty("salt");
    expect(req).not.toHaveProperty("recordId");
    expect(req).not.toHaveProperty("signer");
  });
});
