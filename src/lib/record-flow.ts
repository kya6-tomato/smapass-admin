import type { RecordStatus } from "./go-client/types";

// 記録の入力から送信結果までの状態（FR-P05 の状態図）。画面の部品から切り離して単体テストする

export type Phase =
  | "editing" // 入力中
  | "confirming" // 確認画面
  | "sending" // 送信中
  | "accepted" // 受付済み（Goの pending・submitted）
  | "confirmed" // チェーン記録済み
  | "failed" // 失敗
  | "timeout"; // 受付済みのまま問い合わせの上限を過ぎた

export type FlowState = {
  phase: Phase;
  /** 確認画面を開いた時点で作る。再試行でも同じキーを使う（受け入れ基準5） */
  idempotencyKey: string | null;
  recordId: string | null;
  txHash: string | null;
  /** 失敗の理由（画面に出す文言） */
  errorMessage: string | null;
  /** 失敗がどこで起きたか。send=Goに届いたか不明、chain=Goが失敗と返した */
  failedAt: "send" | "chain" | null;
};

export type FlowAction =
  | { type: "confirm"; idempotencyKey: string }
  | { type: "back" }
  | { type: "send" }
  | { type: "sendFailed"; message: string }
  | { type: "invalid" }
  | { type: "accepted"; recordId: string }
  | { type: "status"; status: RecordStatus; txHash?: string; message?: string }
  | { type: "timeout" }
  | { type: "retry"; newIdempotencyKey: string }
  | { type: "reset" };

export const INITIAL_FLOW: FlowState = {
  phase: "editing",
  idempotencyKey: null,
  recordId: null,
  txHash: null,
  errorMessage: null,
  failedAt: null,
};

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "confirm":
      if (state.phase !== "editing") return state;
      return { ...state, phase: "confirming", idempotencyKey: action.idempotencyKey };
    case "back":
      if (state.phase !== "confirming" && state.phase !== "failed") return state;
      return { ...INITIAL_FLOW };
    case "send":
      if (state.phase !== "confirming") return state; // 二重押しは無視する
      return { ...state, phase: "sending", errorMessage: null, failedAt: null };
    case "sendFailed":
      if (state.phase !== "sending") return state;
      return { ...state, phase: "failed", errorMessage: action.message, failedAt: "send" };
    case "invalid":
      // サーバー側の検証で弾かれたら、入力画面に戻してエラーを見せる
      if (state.phase !== "sending") return state;
      return { ...INITIAL_FLOW };
    case "accepted":
      if (state.phase !== "sending") return state;
      return { ...state, phase: "accepted", recordId: action.recordId };
    case "status":
      if (state.phase !== "accepted") return state;
      if (action.status === "confirmed") {
        return { ...state, phase: "confirmed", txHash: action.txHash ?? null };
      }
      if (action.status === "failed") {
        return {
          ...state,
          phase: "failed",
          errorMessage: action.message ?? null,
          failedAt: "chain",
        };
      }
      return { ...state, txHash: action.txHash ?? state.txHash };
    case "timeout":
      if (state.phase !== "accepted") return state;
      return { ...state, phase: "timeout" };
    case "retry":
      if (state.phase !== "failed") return state;
      return {
        ...state,
        phase: "sending",
        // 送信で失敗したときは、Goに届いていた場合に備えて同じキーで送り直す。
        // Goが失敗と返したときは、その記録はもう終わっているので新しいキーで別の記録として送る
        idempotencyKey: state.failedAt === "chain" ? action.newIdempotencyKey : state.idempotencyKey,
        recordId: state.failedAt === "chain" ? null : state.recordId,
        errorMessage: null,
        failedAt: null,
      };
    case "reset":
      return { ...INITIAL_FLOW };
  }
}

/** 画面に出す状態の名前（受け入れ基準1） */
export function phaseLabel(phase: Phase): string | null {
  switch (phase) {
    case "sending":
      return "送信中";
    case "accepted":
    case "timeout":
      return "受付済み";
    case "confirmed":
      return "チェーン記録済み";
    case "failed":
      return "失敗";
    default:
      return null;
  }
}
