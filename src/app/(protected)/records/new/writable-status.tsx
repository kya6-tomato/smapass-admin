import { formatRemaining } from "@/lib/time";
import { messageForCode } from "@/lib/messages";

type Props = {
  /** 書き込みできる期限があるのはコードで指定した端末だけ。デモ端末では何も出さない */
  hasDeadline: boolean;
  /** 残りミリ秒。画面を描いた直後でまだ時計が読めないときは null */
  remainingMs: number | null;
  expired: boolean;
};

/** 書き込みできる残り時間と、時間切れの案内（FR-P03 基準4） */
export function WritableStatus({ hasDeadline, remainingMs, expired }: Props) {
  if (!hasDeadline) return null;

  if (expired) {
    return (
      <section
        role="alert"
        data-testid="writable-expired"
        className="rounded-lg border border-danger/30 bg-danger-soft px-5 py-4 text-danger"
      >
        <p className="font-semibold">{messageForCode("device_session_expired")}</p>
        <p className="mt-1 text-sm">
          このままでは送信できません。アプリで新しいコードを表示して、入力し直してください。
        </p>
      </section>
    );
  }

  return (
    <p className="text-sm text-ink-soft" data-testid="writable-remaining">
      書き込みできる残り時間：
      <span className="font-mono font-semibold text-ink" data-testid="writable-remaining-time">
        {remainingMs === null ? "—" : formatRemaining(remainingMs)}
      </span>
    </p>
  );
}
