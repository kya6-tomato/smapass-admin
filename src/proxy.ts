import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookieName } from "@/config";

/**
 * 未ログインで記録画面を開いたら /login に移す（FR-P01 受け入れ基準4）。
 * ここではCookieの有無だけを見る。トークンが有効かは (protected)/layout.tsx でGoに確かめる。
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(getSessionCookieName())) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/records/:path*"],
};
