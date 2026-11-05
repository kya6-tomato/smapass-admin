import { expect, test, type Page } from "@playwright/test";
import { QR_PLAIN_CODE, QR_URL_WITH_CODE } from "./qr-fixtures";
import { login } from "./helpers";

// FR-P03 基準5（T-10）。会場PCの実カメラでの確認は tests/manual/demo.md にある。
// ここではカメラの代わりに、(1) QRを描いたcanvasの映像（jsQRの経路）、(2) Chromiumの偽カメラ＋BarcodeDetectorの代役（標準APIの経路）を使う。
// 偽カメラの起動オプションは、このファイルのテストにだけ付ける。
test.use({
  permissions: ["camera"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
});

const CODE_VALID = "123456"; // モックの成功コード（CLAUDE.md）

/** getUserMedia を「QRを描いたcanvasの映像」に差し替える。BarcodeDetector は無い状態にする（Windowsのデスクトップ版を想定） */
async function installCanvasCamera(page: Page, rows: string[]) {
  await page.addInitScript((matrix) => {
    Object.defineProperty(window, "BarcodeDetector", { value: undefined, configurable: true });
    const tracks: MediaStreamTrack[] = [];
    (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks = tracks;
    navigator.mediaDevices.getUserMedia = async () => {
      const scale = 8;
      const quiet = 4;
      const n = matrix.length;
      const size = (n + quiet * 2) * scale;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const draw = () => {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#000";
        matrix.forEach((row, y) =>
          [...row].forEach((c, x) => {
            if (c === "#") ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
          }),
        );
      };
      draw();
      setInterval(draw, 100); // 映像を流し続ける
      const stream = canvas.captureStream(10);
      tracks.push(...stream.getTracks());
      return stream;
    };
  }, rows);
}

/** BarcodeDetector の代役（標準APIの経路）。実際の偽カメラの映像に対して、決めた文字列を返す */
async function installBarcodeDetector(page: Page, rawValue: string) {
  await page.addInitScript((value) => {
    class FakeDetector {
      static async getSupportedFormats() {
        return ["qr_code"];
      }
      async detect() {
        return [{ rawValue: value }];
      }
    }
    Object.defineProperty(window, "BarcodeDetector", { value: FakeDetector, configurable: true });
    const tracks: MediaStreamTrack[] = [];
    (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks = tracks;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const stream = await original(c);
      tracks.push(...stream.getTracks());
      return stream;
    };
  }, rawValue);
}

async function trackStates(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.map((t) => t.readyState),
  );
}

async function expectTargetIsEnteredDevice(page: Page) {
  await expect(page.getByRole("heading", { name: "記録先の端末" })).toBeVisible();
  await expect(page.getByTestId("device-name")).toHaveText("お客様のスマートフォン");
  await expect(page.getByTestId("device-id")).toHaveText("dev_5c0de001");
}

async function enterManually(page: Page, code: string) {
  await page.getByLabel("端末のコード").fill(code);
  await page.getByRole("button", { name: "このコードで指定する" }).click();
}

test.describe("FR-P03 基準5 QRの読み取り", () => {
  test("基準5：QR（コードそのもの）を読み取ると、手入力と同じ処理で記録先になり、カメラは止まる（jsQRの経路）", async ({
    page,
  }) => {
    await installCanvasCamera(page, QR_PLAIN_CODE);
    await login(page);
    await expect(page.getByTestId("device-id")).toHaveText("dev_7f3a9c21");

    await page.getByRole("button", { name: "QRを読み取る" }).click();
    await expect(page.getByTestId("qr-scanner")).toBeVisible();

    // 手入力（基準1）と同じ表示で記録先が変わる
    await expectTargetIsEnteredDevice(page);
    await expect(page.getByTestId("writable-remaining-time")).toHaveText(/^[45]:\d\d$/);
    // 読めたらカメラを閉じ、映像を止める
    await expect(page.getByTestId("qr-scanner")).toHaveCount(0);
    expect(await trackStates(page)).toEqual(["ended"]);

    await page.reload();
    await expect(page.getByTestId("device-id")).toHaveText("dev_5c0de001");
  });

  test("基準5：QRの中身がURLのときは、クエリのコードを取り出して手入力と同じ処理に渡す", async ({ page }) => {
    await installCanvasCamera(page, QR_URL_WITH_CODE);
    await login(page);
    await page.getByRole("button", { name: "QRを読み取る" }).click();
    await expectTargetIsEnteredDevice(page);
  });

  test("基準5：標準のBarcodeDetectorが使えるときはそれで読み取る。読めたらカメラを止める", async ({ page }) => {
    await installBarcodeDetector(page, CODE_VALID);
    await login(page);
    await page.getByRole("button", { name: "QRを読み取る" }).click();
    await expectTargetIsEnteredDevice(page);
    await expect(page.getByTestId("qr-scanner")).toHaveCount(0);
    expect(await trackStates(page)).toEqual(["ended"]);
  });

  test("基準5：QRのコードが誤りなら手入力と同じ文言を出し、読み取ったコードは欄に残り、手入力で直せる", async ({
    page,
  }) => {
    await installBarcodeDetector(page, "000001"); // モック：期限切れ
    await login(page);
    await page.getByRole("button", { name: "QRを読み取る" }).click();
    await expect(page.locator("#device-code-error")).toHaveText("コードの有効期限が切れています");
    await expect(page.getByTestId("device-id")).toHaveText("dev_7f3a9c21");
    await expect(page.getByLabel("端末のコード")).toHaveValue("000001");

    await enterManually(page, CODE_VALID);
    await expectTargetIsEnteredDevice(page);
  });

  test("基準5：URLなのにコードが入っていないQRは、メッセージを出して手入力に任せる", async ({ page }) => {
    await installBarcodeDetector(page, "https://example.com/pair");
    await login(page);
    await page.getByRole("button", { name: "QRを読み取る" }).click();
    await expect(page.locator("#device-code-error")).toHaveText(
      "QRからコードを取り出せませんでした。コードを手入力してください",
    );
    await expect(page.getByTestId("qr-scanner")).toHaveCount(0);
    await enterManually(page, CODE_VALID);
    await expectTargetIsEnteredDevice(page);
  });

  test("基準5：カメラの許可が拒否されたら、メッセージを出しても手入力で続けられる", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("denied", "NotAllowedError");
      };
    });
    await login(page);
    await page.getByRole("button", { name: "QRを読み取る" }).click();
    await expect(page.getByTestId("qr-error")).toContainText("カメラの使用が許可されていません");

    // 手入力はずっと使える
    await expect(page.getByLabel("端末のコード")).toBeEnabled();
    await enterManually(page, CODE_VALID);
    await expectTargetIsEnteredDevice(page);
  });

  test("基準5：カメラがない・使えない環境でも、メッセージを出して手入力で続けられる", async ({ page }) => {
    await page.addInitScript(() => {
      // HTTP接続などで mediaDevices が無い状態
      Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    });
    await login(page);
    await page.getByRole("button", { name: "QRを読み取る" }).click();
    await expect(page.getByTestId("qr-error")).toContainText("このブラウザや接続ではカメラを使えません");
    await enterManually(page, CODE_VALID);
    await expectTargetIsEnteredDevice(page);
  });

  test("基準5：QRが見つからないまま時間が過ぎたら、カメラを止めて手入力を案内する", async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(() => {
      Object.defineProperty(window, "BarcodeDetector", { value: undefined, configurable: true }); // jsQR経路。偽カメラはQRの映らない映像
      const tracks: MediaStreamTrack[] = [];
      (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks = tracks;
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (c) => {
        const stream = await original(c);
        tracks.push(...stream.getTracks());
        return stream;
      };
    });
    await login(page);
    await page.getByRole("button", { name: "QRを読み取る" }).click();
    await expect(page.getByRole("status")).toContainText("QRをカメラに映してください");

    await page.clock.runFor(35_000);
    await expect(page.getByTestId("qr-error")).toContainText("QRを読み取れませんでした");
    expect(await trackStates(page)).toEqual(["ended"]);

    await enterManually(page, CODE_VALID);
    await expectTargetIsEnteredDevice(page);
  });

  test("基準5：カメラを閉じるとカメラが止まり、閉じたあとも手入力できる", async ({ page }) => {
    await installBarcodeDetector(page, ""); // 何も読み取れない
    await login(page);
    await page.getByRole("button", { name: "QRを読み取る" }).click();
    await expect(page.getByRole("status")).toContainText("QRをカメラに映してください");
    expect(await trackStates(page)).toEqual(["live"]);

    await page.getByRole("button", { name: "カメラを閉じる" }).click();
    await expect(page.getByTestId("qr-scanner")).toHaveCount(0);
    expect(await trackStates(page)).toEqual(["ended"]);

    await enterManually(page, CODE_VALID);
    await expectTargetIsEnteredDevice(page);
  });
});
