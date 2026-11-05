import { describe, expect, it } from "vitest";
import { flowReducer, INITIAL_FLOW, phaseLabel, type FlowAction, type FlowState } from "./record-flow";

const run = (actions: FlowAction[], from: FlowState = INITIAL_FLOW) => actions.reduce(flowReducer, from);
const KEY = "11111111-1111-4111-8111-111111111111";
const KEY2 = "22222222-2222-4222-8222-222222222222";

describe("FR-P05 送信の状態", () => {
  it("基準1：送信中 → 受付済み → チェーン記録済み", () => {
    let s = run([{ type: "confirm", idempotencyKey: KEY }, { type: "send" }]);
    expect(phaseLabel(s.phase)).toBe("送信中");
    s = flowReducer(s, { type: "accepted", recordId: "rec_1" });
    expect(phaseLabel(s.phase)).toBe("受付済み");
    s = flowReducer(s, { type: "status", status: "confirmed", txHash: "0xabc" });
    expect(phaseLabel(s.phase)).toBe("チェーン記録済み");
  });

  it("基準1：pending と submitted はどちらも受付済みのまま", () => {
    let s = run([{ type: "confirm", idempotencyKey: KEY }, { type: "send" }, { type: "accepted", recordId: "rec_1" }]);
    s = flowReducer(s, { type: "status", status: "pending" });
    expect(s.phase).toBe("accepted");
    s = flowReducer(s, { type: "status", status: "submitted", txHash: "0xabc" });
    expect(s.phase).toBe("accepted");
  });

  it("基準2・3：記録IDとトランザクションハッシュを持つ", () => {
    const s = run([
      { type: "confirm", idempotencyKey: KEY },
      { type: "send" },
      { type: "accepted", recordId: "rec_1" },
      { type: "status", status: "confirmed", txHash: "0xabc" },
    ]);
    expect(s.recordId).toBe("rec_1");
    expect(s.txHash).toBe("0xabc");
  });

  it("基準4：上限を過ぎたら timeout になり、記録IDは残る", () => {
    const s = run([
      { type: "confirm", idempotencyKey: KEY },
      { type: "send" },
      { type: "accepted", recordId: "rec_1" },
      { type: "timeout" },
    ]);
    expect(s.phase).toBe("timeout");
    expect(s.recordId).toBe("rec_1");
  });

  it("基準5：送信中にもう一度 send しても状態は変わらない（二重送信しない）", () => {
    const sending = run([{ type: "confirm", idempotencyKey: KEY }, { type: "send" }]);
    expect(flowReducer(sending, { type: "send" })).toBe(sending);
  });

  it("基準5：送信で失敗したときの再試行は同じキーを使う", () => {
    const s = run([
      { type: "confirm", idempotencyKey: KEY },
      { type: "send" },
      { type: "sendFailed", message: "サーバーと通信できませんでした" },
      { type: "retry", newIdempotencyKey: KEY2 },
    ]);
    expect(s.phase).toBe("sending");
    expect(s.idempotencyKey).toBe(KEY);
  });

  it("Goが失敗と返したときの再試行は新しいキーで別の記録として送る", () => {
    const s = run([
      { type: "confirm", idempotencyKey: KEY },
      { type: "send" },
      { type: "accepted", recordId: "rec_1" },
      { type: "status", status: "failed", message: "チェーンへの記録に失敗しました" },
      { type: "retry", newIdempotencyKey: KEY2 },
    ]);
    expect(s.idempotencyKey).toBe(KEY2);
    expect(s.recordId).toBeNull();
  });

  it("基準6：失敗すると理由を持ち、入力に戻れる", () => {
    const failed = run([
      { type: "confirm", idempotencyKey: KEY },
      { type: "send" },
      { type: "sendFailed", message: "サーバーと通信できませんでした" },
    ]);
    expect(phaseLabel(failed.phase)).toBe("失敗");
    expect(failed.errorMessage).toBe("サーバーと通信できませんでした");
    expect(flowReducer(failed, { type: "back" }).phase).toBe("editing");
  });

  it("サーバー側の検証で弾かれたら入力画面に戻る", () => {
    const s = run([{ type: "confirm", idempotencyKey: KEY }, { type: "send" }, { type: "invalid" }]);
    expect(s.phase).toBe("editing");
  });
});
