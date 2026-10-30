import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // 本番と同じビルドで確かめる。Goの代わりにモックを使い、問い合わせの間隔と上限を短くする
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      USE_API_MOCK: "true",
      SESSION_COOKIE_NAME: "partner_session",
      POLL_INTERVAL_MS: "300",
      POLL_TIMEOUT_MS: "3000",
    },
  },
});
