import { z } from "zod";
import { LIMITS } from "@/config";
import { RECORD_TYPES, type MaintenanceRecordRequest, type RecordType } from "../go-client/types";
import { jstLocalToUtcIso } from "../time";

// 整備記録の入力の検証（FR-P04）。同じスキーマを画面（確認へ進むとき）とサーバー（送信時）で使う（受け入れ基準7）

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  repair: "修理",
  part_replacement: "部品交換",
  inspection: "点検",
};

export const PART_ORIGIN_LABELS = { genuine: "純正", compatible: "互換" } as const;

/** 修理箇所と使用パーツが必須になる記録の種類（案） */
export function needsRepairDetails(type: RecordType | ""): boolean {
  return type === "repair" || type === "part_replacement";
}

const partSchema = z.object({
  name: z.string().trim().max(LIMITS.partName, `パーツ名は${LIMITS.partName}文字以内で入力してください`),
  origin: z.enum(["genuine", "compatible"], { error: "純正か互換かを選んでください" }),
});

export type RecordFormValues = {
  recordType: RecordType | "";
  /** datetime-local の値（日本時間） */
  workedAt: string;
  repairArea: string;
  parts: { name: string; origin: "genuine" | "compatible" }[];
  inspectionResult: string;
  memo: string;
};

export const EMPTY_FORM: RecordFormValues = {
  recordType: "",
  workedAt: "",
  repairArea: "",
  parts: [{ name: "", origin: "genuine" }],
  inspectionResult: "",
  memo: "",
};

export type FieldErrors = Partial<Record<keyof RecordFormValues, string>>;

/** now を引数にするのは、未来の日時の判定をテストで固定するため */
export function createRecordFormSchema(now: () => Date = () => new Date()) {
  return z
    .object({
      recordType: z.enum(RECORD_TYPES, { error: "記録の種類を選んでください" }),
      workedAt: z.string().min(1, "作業日時を入力してください"),
      repairArea: z
        .string()
        .trim()
        .max(LIMITS.repairArea, `修理箇所は${LIMITS.repairArea}文字以内で入力してください`),
      parts: z.array(partSchema).max(LIMITS.parts, `使用パーツは${LIMITS.parts}件までです`),
      inspectionResult: z
        .string()
        .trim()
        .max(LIMITS.inspectionResult, `点検結果は${LIMITS.inspectionResult}文字以内で入力してください`),
      memo: z.string().max(LIMITS.memo, `メモは${LIMITS.memo}文字以内で入力してください`),
    })
    .superRefine((v, ctx) => {
      const utc = jstLocalToUtcIso(v.workedAt);
      if (v.workedAt && !utc) {
        ctx.addIssue({ code: "custom", path: ["workedAt"], message: "作業日時の形式が正しくありません" });
      } else if (utc && Date.parse(utc) > now().getTime()) {
        ctx.addIssue({ code: "custom", path: ["workedAt"], message: "未来の日時は入力できません" });
      }

      if (needsRepairDetails(v.recordType)) {
        if (!v.repairArea) {
          ctx.addIssue({ code: "custom", path: ["repairArea"], message: "修理箇所を入力してください" });
        }
        if (!v.parts.some((p) => p.name)) {
          ctx.addIssue({ code: "custom", path: ["parts"], message: "使用パーツを1つ以上入力してください" });
        }
      }
      if (v.recordType === "inspection" && !v.inspectionResult) {
        ctx.addIssue({ code: "custom", path: ["inspectionResult"], message: "点検結果を入力してください" });
      }
    });
}

export type ValidRecordForm = z.output<ReturnType<typeof createRecordFormSchema>>;

export type ValidationResult =
  | { ok: true; data: ValidRecordForm }
  | { ok: false; fieldErrors: FieldErrors };

export function validateRecordForm(input: unknown, now?: () => Date): ValidationResult {
  const result = createRecordFormSchema(now).safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof RecordFormValues | undefined;
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, fieldErrors };
}

/** 検証済みの入力を、Goに送る形にする。空の項目は送らない */
export function toApiRequest(deviceId: string, v: ValidRecordForm): MaintenanceRecordRequest {
  const workedAt = jstLocalToUtcIso(v.workedAt);
  if (!workedAt) throw new Error("workedAt must be validated before conversion");

  const parts = v.parts.filter((p) => p.name);
  const content: MaintenanceRecordRequest["content"] = {};
  if (v.repairArea) content.repairArea = v.repairArea;
  if (parts.length > 0) content.parts = parts;
  if (v.inspectionResult) content.inspectionResult = v.inspectionResult;
  if (v.memo) content.memo = v.memo;

  return { deviceId, recordType: v.recordType, workedAt, content };
}
