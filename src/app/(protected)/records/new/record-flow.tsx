"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";
import type { DeviceView } from "@/lib/device";
import { flowReducer, INITIAL_FLOW } from "@/lib/record-flow";
import { EMPTY_FORM, validateRecordForm, type FieldErrors, type RecordFormValues } from "@/lib/schemas/record";
import type { RecordStatusResponse } from "@/app/api/records/[id]/route";
import { submitRecord } from "./actions";
import { ConfirmView } from "./confirm-view";
import { DeviceCard } from "./device-card";
import { RecordForm } from "./record-form";
import { StatusPanel } from "./status-panel";

type Props = {
  device: DeviceView | null;
  polling: { intervalMs: number; timeoutMs: number };
  etherscanTxBase: string;
};

/** 入力 → 確認 → 送信 → 状態表示 をまとめる（FR-P04・FR-P05） */
export function RecordFlow({ device, polling, etherscanTxBase }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<RecordFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [flow, dispatch] = useReducer(flowReducer, INITIAL_FLOW);
  // 二重押し対策：ボタンの無効化に加えて、送信中は関数の入口でも止める（FR-P05 受け入れ基準5）
  const inFlight = useRef(false);

  function goConfirm() {
    const result = validateRecordForm(values);
    if (!result.ok) {
      setErrors(result.fieldErrors);
      return;
    }
    setErrors({});
    dispatch({ type: "confirm", idempotencyKey: crypto.randomUUID() });
  }

  async function send(key: string | null) {
    if (!device || !key || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await submitRecord(device.deviceId, values, key);
      if (res.ok) {
        dispatch({ type: "accepted", recordId: res.recordId });
      } else if (res.kind === "validation") {
        setErrors(res.fieldErrors);
        dispatch({ type: "invalid" });
      } else if (res.kind === "unauthenticated") {
        router.push("/login");
      } else {
        dispatch({ type: "sendFailed", message: res.message });
      }
    } catch {
      dispatch({ type: "sendFailed", message: "サーバーと通信できませんでした" });
    } finally {
      inFlight.current = false;
    }
  }

  function onSend() {
    if (flow.phase !== "confirming") return;
    dispatch({ type: "send" });
    void send(flow.idempotencyKey);
  }

  function onRetry() {
    const newKey = crypto.randomUUID();
    // reducer と同じ規則でキーを決める（Goが失敗と返したときだけ新しいキー）
    const key = flow.failedAt === "chain" ? newKey : flow.idempotencyKey;
    dispatch({ type: "retry", newIdempotencyKey: newKey });
    void send(key);
  }

  function onStartOver() {
    setValues(EMPTY_FORM);
    setErrors({});
    dispatch({ type: "reset" });
  }

  // 受付済みの間、状態を問い合わせる（FR-P05 受け入れ基準4）
  useEffect(() => {
    if (flow.phase !== "accepted" || !flow.recordId) return;
    const recordId = flow.recordId;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function poll() {
      if (stopped) return;
      if (Date.now() - startedAt >= polling.timeoutMs) {
        dispatch({ type: "timeout" });
        return;
      }
      try {
        const res = await fetch(`/api/records/${encodeURIComponent(recordId)}`, { cache: "no-store" });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.ok) {
          const body = (await res.json()) as RecordStatusResponse;
          if (stopped) return;
          dispatch({ type: "status", status: body.status, txHash: body.txHash, message: body.errorMessage });
          if (body.status === "confirmed" || body.status === "failed") return;
        }
        // 一時的な通信エラーは、上限まで問い合わせを続ける
      } catch {
        // 同上
      }
      if (!stopped) timer = setTimeout(poll, polling.intervalMs);
    }

    timer = setTimeout(poll, polling.intervalMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [flow.phase, flow.recordId, polling.intervalMs, polling.timeoutMs, router]);

  const editing = flow.phase === "editing";
  const confirming = flow.phase === "confirming";

  return (
    <div className="mt-6 space-y-6">
      <DeviceCard device={device} />

      {editing && (
        <RecordForm
          values={values}
          errors={errors}
          onChange={setValues}
          onSubmit={goConfirm}
          canSubmit={device !== null}
        />
      )}

      {(confirming || flow.phase === "sending") && (
        <ConfirmView
          values={values}
          sending={flow.phase === "sending"}
          canSend={device !== null}
          onBack={() => dispatch({ type: "back" })}
          onSend={onSend}
        />
      )}

      {!editing && !confirming && flow.phase !== "sending" && (
        <StatusPanel
          flow={flow}
          etherscanTxBase={etherscanTxBase}
          onRetry={onRetry}
          onBackToEdit={() => dispatch({ type: "back" })}
          onStartOver={onStartOver}
        />
      )}
    </div>
  );
}
