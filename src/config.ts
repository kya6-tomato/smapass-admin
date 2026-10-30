// 「案」の数値はここに集める。合意したらこのファイルだけ直せばよい（docs/requirements.md 6章）

/** 状態の問い合わせ間隔（FR-P05 受け入れ基準4。案：3秒） */
export const DEFAULT_POLL_INTERVAL_MS = 3_000;
/** 状態の問い合わせを続ける上限（FR-P05 受け入れ基準4。案：2分） */
export const DEFAULT_POLL_TIMEOUT_MS = 120_000;
/** ログインの有効時間（案：8時間） */
export const SESSION_MAX_AGE_SEC = 8 * 60 * 60;

/** 入力の文字数の上限（FR-P04。メモ500文字は案、それ以外は本実装で仮に置いた値） */
export const LIMITS = {
  memo: 500,
  repairArea: 100,
  partName: 100,
  inspectionResult: 200,
  parts: 10,
} as const;

/** Sepolia Etherscan のトランザクションページ */
export const ETHERSCAN_TX_BASE = "https://sepolia.etherscan.io/tx/";

function readPositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** 問い合わせの設定。E2Eテストでは環境変数で短くする */
export function getPollingConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    intervalMs: readPositiveInt(env.POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS),
    timeoutMs: readPositiveInt(env.POLL_TIMEOUT_MS, DEFAULT_POLL_TIMEOUT_MS),
  };
}

export function getSessionCookieName(env: NodeJS.ProcessEnv = process.env): string {
  return env.SESSION_COOKIE_NAME || "partner_session";
}

export function isMockEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.USE_API_MOCK === "true";
}
