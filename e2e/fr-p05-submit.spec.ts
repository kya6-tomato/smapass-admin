import { expect, test, type Page } from "@playwright/test";
import { clearScenario, fillBatteryReplacement, login, setScenario } from "./helpers";

async function toConfirm(page: Page) {
  await fillBatteryReplacement(page);
  await page.getByRole("button", { name: "確認へ進む" }).click();
  await expect(page.getByRole("heading", { name: "この内容で記録しますか" })).toBeVisible();
}

test.describe("FR-P05 送信と結果表示", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("基準1〜3：送信中 → 受付済み（記録ID）→ チェーン記録済み（ハッシュとEtherscanへのリンク）", async ({
    page,
    context,
  }) => {
    await setScenario(context, "status_slow");
    await toConfirm(page);

    // サーバーの応答を少し遅らせて「送信中」を確実に見る
    await page.route("**/records/new", async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });
    await page.getByRole("button", { name: "この内容で送信する" }).click();
    await expect(page.getByTestId("flow-status")).toHaveText("送信中");
    await expect(page.getByText("送信中", { exact: true })).toHaveCount(1);

    const status = page.getByTestId("flow-status");
    await expect(status).toHaveText("受付済み");
    await expect(page.getByTestId("record-id")).toHaveText(/^rec_/);

    await expect(status).toHaveText("チェーン記録済み", { timeout: 10_000 });
    const tx = await page.getByTestId("tx-hash").innerText();
    expect(tx).toMatch(/^0x[0-9a-f]{64}$/);
    await expect(page.getByRole("link", { name: /Sepolia Etherscanで見る/ })).toHaveAttribute(
      "href",
      `https://sepolia.etherscan.io/tx/${tx}`,
    );
  });

  test("基準4：上限を過ぎたら問い合わせをやめ、記録IDを残して案内する", async ({ page, context }) => {
    await setScenario(context, "status_stuck");
    await toConfirm(page);
    await page.getByRole("button", { name: "この内容で送信する" }).click();
    await expect(page.getByTestId("flow-status")).toHaveText("受付済み");
    await expect(page.getByText("確認に時間がかかっています")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("record-id")).toHaveText(/^rec_/);

    // 上限後は問い合わせが止まっている
    let polls = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/records/")) polls++;
    });
    await page.waitForTimeout(1_000);
    expect(polls).toBe(0);
  });

  test("基準5：送信ボタンを連打しても送信は1回、冪等キーはUUID", async ({ page }) => {
    await toConfirm(page);
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/records/new")) posts.push(r.postData() ?? "");
    });
    const button = page.getByRole("button", { name: "この内容で送信する" });
    // 画面が描き直される前に2回押す（ボタンの無効化が間に合わない最悪のケース）
    await button.evaluate((b: HTMLButtonElement) => {
      b.click();
      b.click();
    });
    await expect(page.getByTestId("flow-status")).toHaveText(/受付済み|チェーン記録済み/);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/);
  });

  test("基準5・6：送信に失敗したら理由と再試行を出し、同じキーで送り直す。入力は残る", async ({
    page,
    context,
  }) => {
    await setScenario(context, "submit_error");
    await toConfirm(page);
    const keys: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/records/new")) {
        keys.push(/[0-9a-f-]{36}/.exec(r.postData() ?? "")?.[0] ?? "");
      }
    });

    await page.getByRole("button", { name: "この内容で送信する" }).click();
    await expect(page.getByTestId("flow-status")).toHaveText("失敗");
    await expect(page.getByRole("alert").filter({ hasText: "サーバーと通信できませんでした" })).toBeVisible();
    await expect(page.getByRole("button", { name: "再試行" })).toBeVisible();

    await clearScenario(context);
    await page.getByRole("button", { name: "再試行" }).click();
    await expect(page.getByTestId("flow-status")).toHaveText(/受付済み|チェーン記録済み/);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  test("基準6：チェーンへの記録に失敗したら理由を出し、入力に戻っても内容が残る", async ({
    page,
    context,
  }) => {
    await setScenario(context, "status_failed");
    await toConfirm(page);
    await page.getByRole("button", { name: "この内容で送信する" }).click();
    await expect(page.getByTestId("flow-status")).toHaveText("失敗", { timeout: 10_000 });
    await expect(page.getByRole("alert").filter({ hasText: "チェーンへの記録に失敗しました" })).toBeVisible();

    await page.getByRole("button", { name: "入力に戻る" }).click();
    await expect(page.getByLabel("修理箇所")).toHaveValue("バッテリー");
    await expect(page.getByLabel("パーツ1の名前")).toHaveValue("バッテリー");
  });
});
