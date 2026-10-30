import { expect, test } from "@playwright/test";
import { fillBatteryReplacement, login } from "./helpers";

test.describe("FR-P04 整備記録の入力", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("基準1：6項目を入力できる", async ({ page }) => {
    await expect(page.getByRole("group", { name: "記録の種類" })).toBeVisible();
    await expect(page.getByLabel("作業日時（日本時間）")).toBeVisible();
    await expect(page.getByLabel("修理箇所")).toBeVisible();
    await expect(page.getByRole("group", { name: "使用パーツ" })).toBeVisible();
    await expect(page.getByLabel("点検結果")).toBeVisible();
    await expect(page.getByLabel("メモ")).toBeVisible();
  });

  test("基準2：記録の種類に訂正・取り消しは出さない", async ({ page }) => {
    const group = page.getByRole("group", { name: "記録の種類" });
    await expect(group.getByRole("radio")).toHaveCount(3);
    await expect(group).not.toContainText("訂正");
    await expect(group).not.toContainText("取り消し");
  });

  test("基準3：必須項目が空のままでは確認画面に進めず、項目の下にエラーが出る", async ({ page }) => {
    await page.getByRole("button", { name: "確認へ進む" }).click();
    await expect(page.getByText("記録の種類を選んでください")).toBeVisible();
    await expect(page.getByText("作業日時を入力してください")).toBeVisible();
    await expect(page.getByRole("heading", { name: "この内容で記録しますか" })).toHaveCount(0);

    await page.getByLabel("修理", { exact: true }).check();
    await page.getByRole("button", { name: "確認へ進む" }).click();
    await expect(page.getByText("修理箇所を入力してください")).toBeVisible();
    await expect(page.getByText("使用パーツを1つ以上入力してください")).toBeVisible();
  });

  test("基準4：未来の日時は入れられない", async ({ page }) => {
    await fillBatteryReplacement(page);
    await page.getByLabel("作業日時（日本時間）").fill("2099-01-01T10:00");
    await page.getByRole("button", { name: "確認へ進む" }).click();
    await expect(page.getByText("未来の日時は入力できません")).toBeVisible();
  });

  test("基準5：メモの上限と、個人情報を書かない注意が出る", async ({ page }) => {
    await expect(page.getByText("お客様の名前や連絡先は書かないでください")).toBeVisible();
    await fillBatteryReplacement(page);
    await page.getByLabel("メモ").fill("あ".repeat(501));
    await expect(page.getByTestId("memo-count")).toHaveText("501 / 500");
    await page.getByRole("button", { name: "確認へ進む" }).click();
    await expect(page.getByText("メモは500文字以内で入力してください")).toBeVisible();
  });

  test("基準6：確認画面で内容を見せ、入力に戻っても内容が残る", async ({ page }) => {
    await fillBatteryReplacement(page);
    await page.getByRole("button", { name: "確認へ進む" }).click();

    const confirm = page.getByRole("region", { name: "この内容で記録しますか" });
    await expect(confirm).toContainText("部品交換");
    await expect(confirm).toContainText("2026/10/20 14:30（日本時間）");
    await expect(confirm).toContainText("バッテリー（純正）");
    await expect(confirm).toContainText("サイクル回数リセット");

    await page.getByRole("button", { name: "入力に戻る" }).click();
    await expect(page.getByLabel("修理箇所")).toHaveValue("バッテリー");
    await expect(page.getByLabel("メモ")).toHaveValue("サイクル回数リセット");
    await expect(page.getByLabel("部品交換")).toBeChecked();
  });
});
