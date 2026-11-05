import { expect, test } from "@playwright/test";
import { DEMO, login, SESSION_COOKIE } from "./helpers";

test.describe("FR-P01 ログイン", () => {
  test("基準1：デモアカウントでログインでき、記録画面に移る", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "整備記録を書く" })).toBeVisible();
    await expect(page.getByTestId("partner-name")).toContainText("デモ修理店");
  });

  test("基準2：IDかパスワードが違うときは、どちらが違うかを出さない", async ({ page }) => {
    for (const [id, pw] of [
      [DEMO.partnerId, "wrong"],
      ["unknown", DEMO.password],
    ]) {
      await page.goto("/login");
      await page.getByLabel("事業者ID").fill(id);
      await page.getByLabel("パスワード").fill(pw);
      await page.getByRole("button", { name: "ログイン" }).click();
      // Next.jsの画面遷移アナウンサーも role="alert" を持つので、文言で絞る
      await expect(page.getByRole("alert").filter({ hasText: "IDまたはパスワードが違います" })).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("基準3：ログイン状態は httpOnly・Secure・SameSite=Lax のCookieで、JavaScriptから読めない", async ({
    page,
    context,
  }) => {
    await login(page);
    const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain(SESSION_COOKIE);
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(storage).toBe("{}");
  });

  test("基準4：未ログインで記録画面を開くとログイン画面に移る", async ({ page }) => {
    await page.goto("/records/new");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("基準4：無効なトークンのCookieでもログイン画面に移る", async ({ page, context }) => {
    await context.addCookies([{ name: SESSION_COOKIE, value: "forged", url: "http://localhost:3100" }]);
    await page.goto("/records/new");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("基準5：ログアウトするとCookieが消え、記録画面を開けなくなる", async ({ page, context }) => {
    await login(page);
    await page.getByRole("button", { name: "ログアウト" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await context.cookies()).find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
    await page.goto("/records/new");
    await expect(page).toHaveURL(/\/login$/);
  });
});
