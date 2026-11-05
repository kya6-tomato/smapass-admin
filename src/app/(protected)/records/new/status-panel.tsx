"use client";

import { phaseLabel, type FlowState } from "@/lib/record-flow";

type Props = {
  flow: FlowState;
  etherscanTxBase: string;
  onRetry: () => void;
  onBackToEdit: () => void;
  onStartOver: () => void;
};

const TONE = {
  sending: "bg-wait-soft text-wait",
  accepted: "bg-wait-soft text-wait",
  timeout: "bg-wait-soft text-wait",
  confirmed: "bg-ok-soft text-ok",
  failed: "bg-danger-soft text-danger",
} as const;

/** 送信後の状態表示（FR-P05） */
export function StatusPanel({ flow, etherscanTxBase, onRetry, onBackToEdit, onStartOver }: Props) {
  const label = phaseLabel(flow.phase);
  const tone = TONE[flow.phase as keyof typeof TONE] ?? "";

  return (
    <section aria-labelledby="status-heading" className="rounded-lg border border-line bg-surface p-6">
      <h2 id="status-heading" className="text-sm font-semibold text-ink-soft">
        送信結果
      </h2>
      <p
        role="status"
        aria-live="polite"
        data-testid="flow-status"
        className={`mt-2 inline-block rounded-md px-3 py-1.5 text-lg font-bold ${tone}`}
      >
        {label}
      </p>

      {flow.phase === "accepted" && (
        <p className="mt-3 text-sm text-ink-soft">
          チェーンへの記録を待っています。数秒〜数十秒かかります。
        </p>
      )}
      {flow.phase === "timeout" && (
        <p className="mt-3 text-sm text-wait">
          確認に時間がかかっています。記録IDを控えて、あとで確認してください。
        </p>
      )}

      {flow.recordId && (
        <dl className="mt-4 grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
          <dt className="font-semibold text-ink-soft">記録ID</dt>
          <dd className="font-mono" data-testid="record-id">
            {flow.recordId}
          </dd>
          {flow.phase === "confirmed" && flow.txHash && (
            <>
              <dt className="font-semibold text-ink-soft">トランザクション</dt>
              <dd className="font-mono break-all" data-testid="tx-hash">
                {flow.txHash}
              </dd>
            </>
          )}
        </dl>
      )}

      {flow.phase === "confirmed" && flow.txHash && (
        <a
          href={`${etherscanTxBase}${flow.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block font-semibold text-brand hover:underline"
        >
          Sepolia Etherscanで見る ↗
        </a>
      )}

      {flow.phase === "failed" && (
        <div className="mt-4">
          <p role="alert" className="text-danger">
            {flow.errorMessage ?? "送信に失敗しました"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">入力内容は残っています。</p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-strong"
            >
              再試行
            </button>
            <button
              type="button"
              onClick={onBackToEdit}
              className="rounded-md border border-line px-5 py-2.5 hover:bg-canvas"
            >
              入力に戻る
            </button>
          </div>
        </div>
      )}

      {(flow.phase === "confirmed" || flow.phase === "timeout") && (
        <div className="mt-6 border-t border-line pt-4">
          <button
            type="button"
            onClick={onStartOver}
            className="rounded-md border border-line px-5 py-2.5 hover:bg-canvas"
          >
            続けて別の記録を書く
          </button>
        </div>
      )}
    </section>
  );
}
