"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

const INITIAL: LoginState = { error: null, partnerId: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, INITIAL);

  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <label htmlFor="partnerId" className="block text-sm font-semibold">
          事業者ID
        </label>
        <input
          id="partnerId"
          name="partnerId"
          type="text"
          autoComplete="username"
          defaultValue={state.partnerId}
          required
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-semibold">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "ログインしています…" : "ログイン"}
      </button>
    </form>
  );
}
