import { expect, test } from "@playwright/test";
import { login, setScenario } from "./helpers";

test.describe("FR-P02 端末の指定（固定）", () => {
  test("基準1・2：デモ端末が記録先として、匿名化した端末IDで表示される", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "記録先の端末" })).toBeVisible();
    await expect(page.getByTestId("device-name")).toHaveText("デモ端末");
    await expect(page.getByTestId("device-id")).toHaveText("dev_7f3a9c21");
  });

  test("基準3：端末が取れないときはメッセージを出し、先へ進めない", async ({ page, context }) => {
    await login(page);
    await setScenario(context, "device_missing");
    await page.reload();
    await expect(page.getByText("記録先の端末を取得できません")).toBeVisible();
    await expect(page.getByRole("button", { name: "確認へ進む" })).toBeDisabled();
  });
});
