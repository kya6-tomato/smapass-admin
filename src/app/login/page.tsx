import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ログイン | SmaPass 事業者向け" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="text-sm font-semibold tracking-wide text-brand">SmaPass 事業者向け</p>
        <h1 className="mt-1 text-2xl font-bold">整備記録にログイン</h1>
        <p className="mt-2 text-sm text-ink-soft">
          修理・部品交換・点検の記録を、端末の履歴に書き込みます。
        </p>
        <div className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
