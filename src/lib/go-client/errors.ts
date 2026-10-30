/** Goから返ったエラー。code は docs/api-contract.md のエラーコード */
export class GoApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    // 入力内容がログに混ざらないよう、メッセージにはコードだけを入れる
    super(`Go API error: ${status} ${code}`);
    this.name = "GoApiError";
  }
}

export function isGoApiError(e: unknown, code?: string): e is GoApiError {
  return e instanceof GoApiError && (code === undefined || e.code === code);
}
