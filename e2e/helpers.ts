import { expect, type BrowserContext, type Page } from "@playwright/test";

export const DEMO = { partnerId: "demo-repair", password: "demo-password" };
export const SESSION_COOKIE = "partner_session";

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("事業者ID").fill(DEMO.partnerId);
  await page.getByLabel("パスワード").fill(DEMO.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/records\/new$/);
}

/** モックの振る舞いを切り替える（src/lib/go-client/mock.ts の MOCK_SCENARIOS） */
export async function setScenario(context: BrowserContext, scenario: string) {
  await context.addCookies([{ name: "mock_scenario", value: scenario, url: "http://localhost:3100" }]);
}

export async function clearScenario(context: BrowserContext) {
  await context.clearCookies({ name: "mock_scenario" });
}

/** 部品交換の記録を入力して確認画面まで進む */
export async function fillBatteryReplacement(page: Page) {
  await page.getByLabel("部品交換").check();
  await page.getByLabel("作業日時（日本時間）").fill("2026-10-20T14:30");
  await page.getByLabel("修理箇所").fill("バッテリー");
  await page.getByLabel("パーツ1の名前").fill("バッテリー");
  await page.getByLabel("パーツ1の純正・互換").selectOption("genuine");
  await page.getByLabel("メモ").fill("サイクル回数リセット");
}
