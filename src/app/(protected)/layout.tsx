import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { isMockEnabled } from "@/config";
import { getGoClient, isGoApiError, type PartnerType } from "@/lib/go-client";
import { getSessionToken } from "@/lib/session";

const TYPE_LABELS: Record<PartnerType, string> = {
  manufacturer: "メーカー",
  repair_shop: "修理業者",
  used_shop: "中古店",
};

export default function ProtectedLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <p className="font-bold">
            SmaPass <span className="font-semibold text-brand">事業者向け</span>
          </p>
          <Suspense fallback={<span className="text-sm text-ink-soft">読み込み中…</span>}>
            <Account />
          </Suspense>
        </div>
      </header>
      <Suspense fallback={<p className="mx-auto max-w-4xl px-6 py-8 text-ink-soft">読み込み中…</p>}>
        <Guard>{children}</Guard>
      </Suspense>
    </>
  );
}

/** トークンが有効かGoに確かめる。無効ならログイン画面へ（FR-P01 受け入れ基準4） */
async function getMeOrRedirect() {
  const token = await getSessionToken();
  if (!token) redirect("/login");
  try {
    return await (await getGoClient()).getMe(token);
  } catch (e) {
    if (isGoApiError(e, "unauthenticated")) redirect("/login");
    throw e;
  }
}

async function Guard({ children }: { children: React.ReactNode }) {
  await getMeOrRedirect();
  return <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>;
}

async function Account() {
  const me = await getMeOrRedirect();
  return (
    <div className="flex items-center gap-4 text-sm">
      {isMockEnabled() && (
        <span className="rounded bg-wait-soft px-2 py-0.5 text-xs font-semibold text-wait">
          モック接続
        </span>
      )}
      <span data-testid="partner-name">
        {me.name}
        <span className="ml-2 text-ink-soft">{TYPE_LABELS[me.type]}</span>
      </span>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-md border border-line px-3 py-1.5 hover:bg-canvas"
        >
          ログアウト
        </button>
      </form>
    </div>
  );
}
