"use client";

import { LIMITS } from "@/config";
import { RECORD_TYPES, type RecordType } from "@/lib/go-client/types";
import {
  needsRepairDetails,
  PART_ORIGIN_LABELS,
  RECORD_TYPE_LABELS,
  type FieldErrors,
  type RecordFormValues,
} from "@/lib/schemas/record";

type Props = {
  values: RecordFormValues;
  errors: FieldErrors;
  onChange: (v: RecordFormValues) => void;
  onSubmit: () => void;
  canSubmit: boolean;
};

const inputClass =
  "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 aria-[invalid=true]:border-danger";

/** 日本時間の今（datetime-local の形式） */
function nowJstLocal(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16);
}

/** 整備記録の入力（FR-P04） */
export function RecordForm({ values, errors, onChange, onSubmit, canSubmit }: Props) {
  const set = <K extends keyof RecordFormValues>(key: K, value: RecordFormValues[K]) =>
    onChange({ ...values, [key]: value });
  const repairRequired = needsRepairDetails(values.recordType);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-6 rounded-lg border border-line bg-surface p-6"
    >
      <fieldset>
        <legend className="text-sm font-semibold">
          記録の種類 <Required />
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {RECORD_TYPES.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-4 py-2 has-checked:border-brand has-checked:bg-brand/5"
            >
              <input
                type="radio"
                name="recordType"
                value={t}
                checked={values.recordType === t}
                onChange={() => set("recordType", t as RecordType)}
              />
              {RECORD_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
        <FieldError id="recordType-error" message={errors.recordType} />
      </fieldset>

      <div>
        <label htmlFor="workedAt" className="text-sm font-semibold">
          作業日時（日本時間） <Required />
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="workedAt"
            type="datetime-local"
            value={values.workedAt}
            onChange={(e) => set("workedAt", e.target.value)}
            aria-invalid={!!errors.workedAt}
            aria-describedby="workedAt-error"
            className={`${inputClass} mt-0 max-w-xs`}
          />
          <button
            type="button"
            onClick={() => set("workedAt", nowJstLocal())}
            className="rounded-md border border-line px-3 text-sm hover:bg-canvas"
          >
            今の日時
          </button>
        </div>
        <FieldError id="workedAt-error" message={errors.workedAt} />
      </div>

      <div>
        <label htmlFor="repairArea" className="text-sm font-semibold">
          修理箇所 {repairRequired && <Required />}
        </label>
        <input
          id="repairArea"
          type="text"
          value={values.repairArea}
          maxLength={LIMITS.repairArea}
          placeholder="例：バッテリー"
          onChange={(e) => set("repairArea", e.target.value)}
          aria-invalid={!!errors.repairArea}
          aria-describedby="repairArea-error"
          className={inputClass}
        />
        <FieldError id="repairArea-error" message={errors.repairArea} />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">使用パーツ {repairRequired && <Required />}</legend>
        <ul className="mt-2 space-y-2">
          {values.parts.map((part, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="text"
                aria-label={`パーツ${i + 1}の名前`}
                value={part.name}
                maxLength={LIMITS.partName}
                placeholder="例：バッテリー"
                onChange={(e) =>
                  set(
                    "parts",
                    values.parts.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)),
                  )
                }
                aria-invalid={!!errors.parts}
                className={`${inputClass} mt-0`}
              />
              <select
                aria-label={`パーツ${i + 1}の純正・互換`}
                value={part.origin}
                onChange={(e) =>
                  set(
                    "parts",
                    values.parts.map((p, j) =>
                      j === i ? { ...p, origin: e.target.value as "genuine" | "compatible" } : p,
                    ),
                  )
                }
                className="rounded-md border border-line bg-surface px-3 py-2"
              >
                <option value="genuine">{PART_ORIGIN_LABELS.genuine}</option>
                <option value="compatible">{PART_ORIGIN_LABELS.compatible}</option>
              </select>
              {values.parts.length > 1 && (
                <button
                  type="button"
                  onClick={() => set("parts", values.parts.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-md px-2 py-2 text-sm text-ink-soft hover:bg-canvas"
                >
                  削除
                </button>
              )}
            </li>
          ))}
        </ul>
        {values.parts.length < LIMITS.parts && (
          <button
            type="button"
            onClick={() => set("parts", [...values.parts, { name: "", origin: "genuine" }])}
            className="mt-2 text-sm font-semibold text-brand hover:underline"
          >
            ＋ パーツを追加
          </button>
        )}
        <FieldError id="parts-error" message={errors.parts} />
      </fieldset>

      <div>
        <label htmlFor="inspectionResult" className="text-sm font-semibold">
          点検結果 {values.recordType === "inspection" && <Required />}
        </label>
        <input
          id="inspectionResult"
          type="text"
          value={values.inspectionResult}
          maxLength={LIMITS.inspectionResult}
          placeholder="例：異常なし"
          onChange={(e) => set("inspectionResult", e.target.value)}
          aria-invalid={!!errors.inspectionResult}
          aria-describedby="inspectionResult-error"
          className={inputClass}
        />
        <FieldError id="inspectionResult-error" message={errors.inspectionResult} />
      </div>

      <div>
        <label htmlFor="memo" className="text-sm font-semibold">
          メモ
        </label>
        <p id="memo-note" className="mt-1 text-sm text-wait">
          お客様の名前や連絡先は書かないでください
        </p>
        <textarea
          id="memo"
          rows={4}
          value={values.memo}
          onChange={(e) => set("memo", e.target.value)}
          aria-invalid={!!errors.memo}
          aria-describedby="memo-note memo-error"
          className={inputClass}
        />
        <p className="mt-1 text-right text-xs text-ink-soft" data-testid="memo-count">
          {values.memo.length} / {LIMITS.memo}
        </p>
        <FieldError id="memo-error" message={errors.memo} />
      </div>

      <div className="flex justify-end border-t border-line pt-4">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-brand px-6 py-2.5 font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          確認へ進む
        </button>
      </div>
    </form>
  );
}

function Required() {
  return (
    <span className="ml-1 rounded bg-danger-soft px-1.5 py-0.5 text-xs font-semibold text-danger">
      必須
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-danger">
      {message}
    </p>
  );
}
