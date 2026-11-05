// 作業日時の変換。画面は日本時間、Goに送るのはUTC・Z付き・秒まで（docs/specs/FR-P04.md「日時の扱い」）
// ハッシュの一致に関わるので、変換はこのファイルの関数だけで行う

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * datetime-local の値（日本時間, "YYYY-MM-DDTHH:mm"）を UTC の "YYYY-MM-DDTHH:mm:ssZ" にする。
 * 形式が違う・存在しない日時（2月30日など）なら null。
 */
export function jstLocalToUtcIso(local: string): string | null {
  const m = LOCAL_PATTERN.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(asUtc);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    check.getUTCHours() !== h ||
    check.getUTCMinutes() !== mi
  ) {
    return null;
  }
  return new Date(asUtc - JST_OFFSET_MS).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** 確認画面用の表示（例 "2026/11/10 14:30（日本時間）"） */
export function formatJstLocal(local: string): string {
  const m = LOCAL_PATTERN.exec(local);
  if (!m) return local;
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}（日本時間）`;
}
