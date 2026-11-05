// Goのエラーコード → 画面に出す文言（docs/api-contract.md のエラーコード表）
// Goの message は開発者向けなので、画面には出さない

const MESSAGES: Record<string, string> = {
  invalid_credentials: "IDまたはパスワードが違います",
  device_not_found: "記録先の端末を取得できません",
  code_invalid: "コードが正しくありません",
  code_expired: "コードの有効期限が切れています",
  code_used: "このコードはすでに使われています",
  too_many_attempts: "入力回数の上限に達しました。アプリで新しいコードを表示してください",
  device_session_expired: "書き込みできる時間が終わりました",
  validation_failed: "入力内容に誤りがあります",
  chain_submit_failed: "チェーンへの記録に失敗しました",
  network_error: "サーバーと通信できませんでした",
};

export const FALLBACK_MESSAGE = "エラーが発生しました。時間をおいて再度お試しください";

export function messageForCode(code: string | undefined): string {
  return (code && MESSAGES[code]) || FALLBACK_MESSAGE;
}
