import { expect, test, type Page } from "@playwright/test";
import { clearScenario, fillBatteryReplacement, login, setScenario } from "./helpers";

// モックのコード（src/lib/go-client/mock.ts の MOCK_CODES）
const CODE = {
  valid: "123456",
  shortSession: "000004",
  expired: "000001",
  used: "000002",
  tooMany: "000003",
};

async function enterCode(page: Page, code: string) {
  await page.getByLabel("端末のコード").fill(code);
  await page.getByRole("button", { name: "このコードで指定する" }).click();
}

test.describe("FR-P03 端末の指定（コード手入力）", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("基準1：コードを入れると、その端末が記録先になりFR-P02と同じ表示で出る。開き直しても残る", async ({
    page,
  }) => {
    // 最初はデモ端末
    await expect(page.getByTestId("device-id")).toHaveText("dev_7f3a9c21");

    await enterCode(page, `  ${CODE.valid}  `); // 前後の空白は取り除いて送る
    await expect(page.getByRole("heading", { name: "記録先の端末" })).toBeVisible();
    await expect(page.getByTestId("device-name")).toHaveText("お客様のスマートフォン");
    await expect(page.getByTestId("device-id")).toHaveText("dev_5c0de001");

    await page.reload();
    await expect(page.getByTestId("device-id")).toHaveText("dev_5c0de001");
  });

  test("基準1：指定した端末に記録を送れる", async ({ page }) => {
    await enterCode(page, CODE.valid);
    await expect(page.getByTestId("device-id")).toHaveText("dev_5c0de001");
    await fillBatteryReplacement(page);
    await page.getByRole("button", { name: "確認へ進む" }).click();
    await page.getByRole("button", { name: "この内容で送信する" }).click();
    await expect(page.getByTestId("flow-status")).toHaveText(/受付済み|チェーン記録済み/);
    await expect(page.getByTestId("record-id")).toHaveText(/^rec_/);
  });

  test("基準2：期限切れ・使用済み・誤りで別々のメッセージを出し、記録先は変わらない", async ({ page }) => {
    const alert = page.locator("#device-code-error");

    await enterCode(page, CODE.expired);
    await expect(alert).toHaveText("コードの有効期限が切れています");

    await enterCode(page, CODE.used);
    await expect(alert).toHaveText("このコードはすでに使われています");

    await enterCode(page, `ng-${Date.now()}`);
    await expect(alert).toHaveText("コードが正しくありません");

    await expect(page.getByTestId("device-id")).toHaveText("dev_7f3a9c21");
  });

  test("基準2：空のままではGoに送らず、入力を促す", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST") posts.push(r.url());
    });
    await page.getByRole("button", { name: "このコードで指定する" }).click();
    await expect(page.locator("#device-code-error")).toHaveText("コードを入力してください");
    await page.getByLabel("端末のコード").fill("   ");
    await page.getByRole("button", { name: "このコードで指定する" }).click();
    await expect(page.locator("#device-code-error")).toHaveText("コードを入力してください");
    expect(posts).toHaveLength(0);
  });

  test("基準3：回数制限はGoの判定。サイトは数えず、毎回Goに送って too_many_attempts の文言を出す", async ({
    page,
  }) => {
    const alert = page.locator("#device-code-error");

    await enterCode(page, CODE.tooMany);
    await expect(alert).toHaveText("入力回数の上限に達しました。アプリで新しいコードを表示してください");

    // 同じ誤りコードを続けて入れる。モックのGoは6回目から too_many_attempts を返す
    const wrong = `wrong-${Date.now()}`;
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST") posts.push(r.url());
    });
    for (let i = 1; i <= 5; i++) {
      await enterCode(page, wrong);
      await expect(alert).toHaveText("コードが正しくありません");
      await expect(page.getByRole("button", { name: "このコードで指定する" })).toBeEnabled();
    }
    await enterCode(page, wrong);
    await expect(alert).toHaveText("入力回数の上限に達しました。アプリで新しいコードを表示してください");
    expect(posts).toHaveLength(6); // サイトが先回りして止めていない
    // 上限に達したあとも入力欄は使える（判定はGoに任せる）
    await expect(page.getByRole("button", { name: "このコードで指定する" })).toBeEnabled();
  });

  test("基準4：残り時間を表示し、時間切れで送信ボタンを押せなくして再入力を促す。再入力で送れる", async ({
    page,
  }) => {
    await fillBatteryReplacement(page);
    await enterCode(page, CODE.shortSession);
    await expect(page.getByTestId("device-id")).toHaveText("dev_5c0de002");
    await expect(page.getByTestId("writable-remaining-time")).toHaveText(/^0:0[1-6]$/);

    await page.getByRole("button", { name: "確認へ進む" }).click();
    const send = page.getByRole("button", { name: "この内容で送信する" });
    await expect(send).toBeEnabled();

    // 時間切れ
    const expired = page.getByTestId("writable-expired");
    await expect(expired).toBeVisible({ timeout: 15_000 });
    await expect(expired).toContainText("書き込みできる時間が終わりました");
    await expect(page.getByRole("heading", { name: "コードを入力し直してください" })).toBeVisible();
    await expect(send).toBeDisabled();

    // コードを再入力すると送れる
    await enterCode(page, CODE.valid);
    await expect(page.getByTestId("writable-expired")).toHaveCount(0);
    await expect(page.getByTestId("writable-remaining-time")).toHaveText(/^[45]:\d\d$/);
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.getByTestId("flow-status")).toHaveText(/受付済み|チェーン記録済み/);
  });

  test("基準4：送信時にGoが device_session_expired を返したら、メッセージを出して再入力を促す", async ({
    page,
    context,
  }) => {
    await enterCode(page, CODE.valid);
    await expect(page.getByTestId("device-id")).toHaveText("dev_5c0de001");
    await fillBatteryReplacement(page);
    await page.getByRole("button", { name: "確認へ進む" }).click();

    await setScenario(context, "submit_session_expired");
    await page.getByRole("button", { name: "この内容で送信する" }).click();
    await expect(page.getByTestId("writable-expired")).toContainText("書き込みできる時間が終わりました");
    await expect(page.getByRole("button", { name: "この内容で送信する" })).toBeDisabled();
    await expect(page.getByLabel("端末のコード")).toBeVisible();

    // Go側が元に戻った想定で、コードを入れ直すと同じ内容を送れる
    await clearScenario(context);
    await enterCode(page, CODE.valid);
    await expect(page.getByRole("button", { name: "この内容で送信する" })).toBeEnabled();
    await page.getByRole("button", { name: "この内容で送信する" }).click();
    await expect(page.getByTestId("flow-status")).toHaveText(/受付済み|チェーン記録済み/);
  });
});
