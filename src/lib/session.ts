import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSessionCookieName, SESSION_MAX_AGE_SEC } from "@/config";
import { parseTargetCookie, serializeTarget, type TargetDevice } from "./device-session";
import { remainingMs } from "./time";

/** Goから受け取ったトークンを httpOnly Cookie に保存する（FR-P01 受け入れ基準3） */
export async function setSessionToken(token: string) {
  (await cookies()).set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(getSessionCookieName())?.value;
}

/** ログアウト時に呼ぶ。コードで指定した記録先も一緒に忘れる */
export async function clearSessionToken() {
  const store = await cookies();
  store.delete(getSessionCookieName());
  store.delete(DEVICE_COOKIE);
}

const DEVICE_COOKIE = "partner_device_session";

/**
 * コードで指定した記録先を覚える（FR-P03）。httpOnly Cookie に端末IDと期限だけを入れる。
 * 書き込みの可否を決めるのはGo（device_session_expired）。これは画面を開き直したときの表示用。
 */
export async function setDeviceTarget(target: TargetDevice) {
  const left = target.writableUntil ? remainingMs(target.writableUntil, Date.now()) : null;
  if (!left) return;
  (await cookies()).set(DEVICE_COOKIE, serializeTarget(target), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.ceil(left / 1000),
  });
}

export async function getDeviceTarget(): Promise<TargetDevice | null> {
  const raw = (await cookies()).get(DEVICE_COOKIE)?.value;
  // 現在時刻を読むので、リクエスト時に実行する（Cache Components のビルド時描画で Date.now() を読まないため）
  await connection();
  return parseTargetCookie(raw, Date.now());
}
