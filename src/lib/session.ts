import "server-only";
import { cookies } from "next/headers";
import { getSessionCookieName, SESSION_MAX_AGE_SEC } from "@/config";

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

export async function clearSessionToken() {
  (await cookies()).delete(getSessionCookieName());
}
