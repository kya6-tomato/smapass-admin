"use client";

import {
  PART_ORIGIN_LABELS,
  RECORD_TYPE_LABELS,
  type RecordFormValues,
} from "@/lib/schemas/record";
import { formatJstLocal } from "@/lib/time";

type Props = {
  values: RecordFormValues;
  sending: boolean;
  canSend: boolean;
  onBack: () => void;
  onSend: () => void;
};

/** 送信前の確認画面（FR-P04 受け入れ基準6） */
export function ConfirmView({ values, sending, canSend, onBack, onSend }: Props) {
  const parts = values.parts.filter((p) => p.name.trim());
  const rows: [string, string][] = [
    ["記録の種類", values.recordType ? RECORD_TYPE_LABELS[values.recordType] : ""],
    ["作業日時", formatJstLocal(values.workedAt)],
    ["修理箇所", values.repairArea.trim()],
    ["使用パーツ", parts.map((p) => `${p.name.trim()}（${PART_ORIGIN_LABELS[p.origin]}）`).join("、")],
    ["点検結果", values.inspectionResult.trim()],
    ["メモ", values.memo],
  ];

  return (
    <section aria-labelledby="confirm-heading" className="rounded-lg border border-line bg-surface p-6">
      <h2 id="confirm-heading" className="text-lg font-bold">
        この内容で記録しますか
      </h2>
      <p className="mt-1 text-sm text-ink-soft">送信すると取り消せません。内容をよく確認してください。</p>

      <dl className="mt-4 divide-y divide-line border-y border-line">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[8rem_1fr] gap-4 py-3">
            <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
            <dd className="whitespace-pre-wrap break-words">{value || "—"}</dd>
          </div>
        ))}
      </dl>

      {sending && (
        <p role="status" data-testid="flow-status" className="mt-4 rounded-md bg-wait-soft px-3 py-2 text-sm font-semibold text-wait">
          送信中
        </p>
      )}

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={sending}
          className="rounded-md border border-line px-5 py-2.5 hover:bg-canvas disabled:opacity-50"
        >
          入力に戻る
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={sending || !canSend}
          className="rounded-md bg-brand px-6 py-2.5 font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          この内容で送信する
        </button>
      </div>
    </section>
  );
}
