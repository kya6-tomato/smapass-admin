"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";
import { isWriteWindowClosed, type TargetDevice } from "@/lib/device-session";
import { flowReducer, INITIAL_FLOW } from "@/lib/record-flow";
import { remainingMs } from "@/lib/time";
import { EMPTY_FORM, validateRecordForm, type FieldErrors, type RecordFormValues } from "@/lib/schemas/record";
import type { RecordStatusResponse } from "@/app/api/records/[id]/route";
import { submitRecord } from "./actions";
import { CodeEntry } from "./code-entry";
import { ConfirmView } from "./confirm-view";
import { DeviceCard } from "./device-card";
import { RecordForm } from "./record-form";
import { StatusPanel } from "./status-panel";
import { useNow } from "./use-now";
import { WritableStatus } from "./writable-status";

type Props = {
  /** 記録先。コードで指定した端末か、段階1のデモ端末。取れなければ null */
  initialDevice: TargetDevice | null;
  polling: { intervalMs: number; timeoutMs: number };
  etherscanTxBase: string;
};

/** 入力 → 確認 → 送信 → 状態表示 をまとめる（FR-P04・FR-P05） */
export function RecordFlow({ initialDevice, polling, etherscanTxBase }: Props) {
  const router = useRouter();
  const [device, setDevice] = useState<TargetDevice | null>(initialDevice);
  // Goから device_session_expired が返ったら、手元の時計に関わらず時間切れとして扱う（FR-P03 基準4）
  const [forcedExpired, setForcedExpired] = useState(false);
  const now = useNow(device?.writableUntil != null);
  const expired = device !== null && (forcedExpired || (now !== null && isWriteWindowClosed(device, now)));
  const leftMs = device?.writableUntil != null && now !== null ? remainingMs(device.writableUntil, now) : null;
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
    if (!device || !key || expired || inFlight.current) return;
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
      } else if (res.kind === "session_expired") {
        setForcedExpired(true);
        dispatch({ type: "sessionExpired" });
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

  function onDeviceEntered(target: TargetDevice) {
    setDevice(target);
    setForcedExpired(false);
  }

  const editing = flow.phase === "editing";
  // 送信中・送信後はコードの入れ替えを受け付けない（送信先が途中で変わらないように）
  const canEnterCode = editing || flow.phase === "confirming" || flow.phase === "failed";
  const confirming = flow.phase === "confirming";

  return (
    <div className="mt-6 space-y-6">
      <DeviceCard device={device} />
      <WritableStatus hasDeadline={device?.writableUntil != null} remainingMs={leftMs} expired={expired} />
      {canEnterCode && (
        <CodeEntry
          expired={expired}
          onEntered={onDeviceEntered}
          onUnauthenticated={() => router.push("/login")}
        />
      )}

      {editing && (
        <RecordForm
          values={values}
          errors={errors}
          onChange={setValues}
          onSubmit={goConfirm}
          canSubmit={device !== null && !expired}
        />
      )}

      {(confirming || flow.phase === "sending") && (
        <ConfirmView
          values={values}
          sending={flow.phase === "sending"}
          canSend={device !== null && !expired}
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
