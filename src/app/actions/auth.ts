"use server";

import { redirect } from "next/navigation";
import { getGoClient, isGoApiError } from "@/lib/go-client";
import { messageForCode } from "@/lib/messages";
import { clearSessionToken, getSessionToken, setSessionToken } from "@/lib/session";

export type LoginState = { error: string | null; partnerId: string };

/** ログイン（FR-P01）。IDとパスワードの判定はGoが行う */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const partnerId = String(formData.get("partnerId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!partnerId || !password) {
    return { error: "IDとパスワードを入力してください", partnerId };
  }

  try {
    const client = await getGoClient();
    const { token } = await client.login({ partnerId, password });
    await setSessionToken(token);
  } catch (e) {
    // 受け入れ基準2：どちらが違うかは出さない（Goの invalid_credentials をそのまま1つの文言にする）
    const message = isGoApiError(e, "invalid_credentials")
      ? messageForCode("invalid_credentials")
      : "ログインできませんでした。時間をおいて再度お試しください";
    return { error: message, partnerId };
  }
  redirect("/records/new");
}

/** ログアウト（FR-P01 受け入れ基準5）。Go側の失敗に関係なくCookieは消す */
export async function logout() {
  const token = await getSessionToken();
  if (token) {
    try {
      await (await getGoClient()).logout(token);
    } catch {
      // Goに届かなくても、このブラウザからはログアウトさせる
    }
  }
  await clearSessionToken();
  redirect("/login");
}
