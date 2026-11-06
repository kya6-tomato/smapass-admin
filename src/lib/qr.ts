import { QR_CODE_QUERY_PARAM } from "@/config";

/**
 * QRを読み取った文字列 → Goに送るコード（FR-P03 基準5）。
 * QRの中身は未決なので、URLならクエリパラメータからコードを取り、それ以外は文字列をそのままコードとして扱う。
 * 取り出せないとき（空、URLなのにパラメータがない）は null。コードの形式はここでも判定しない（Goが判定する）。
 */
export function extractCodeFromQrText(text: unknown, paramName: string = QR_CODE_QUERY_PARAM): string | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 「スキーム://」で始まるものだけをURLとみなす。"123456" や "AB:12" のようなコードを誤ってURL扱いしない
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    const value = url.searchParams.get(paramName)?.trim();
    return value ? value : null;
  }
  return trimmed;
}

/** カメラを開けなかった理由 → 画面に出す文言。どの文言でも手入力は続けられる */
export function describeCameraError(error: unknown): string {
  const name =
    typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "カメラの使用が許可されていません。ブラウザのカメラの許可を確認するか、コードを手入力してください";
    case "NotFoundError":
    case "OverconstrainedError":
      return "カメラが見つかりません。コードを手入力してください";
    case "NotReadableError":
    case "AbortError":
      return "カメラを開けません。ほかのアプリで使用中の可能性があります。コードを手入力してください";
    default:
      return "カメラを使えませんでした。コードを手入力してください";
  }
}

export const CAMERA_UNSUPPORTED_MESSAGE =
  "このブラウザや接続ではカメラを使えません（HTTPSまたはlocalhostで開いているか確認してください）。コードを手入力してください";

export const QR_NOT_FOUND_MESSAGE =
  "QRを読み取れませんでした。QRを明るい場所でカメラに近づけてもう一度試すか、コードを手入力してください";

/** QRは読めたが、コードを取り出せなかったとき（URLにコードがない、など） */
export const QR_NO_CODE_MESSAGE = "QRからコードを取り出せませんでした。コードを手入力してください";
