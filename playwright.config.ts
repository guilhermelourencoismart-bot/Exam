import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e", fullyParallel: false, workers: 1,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {} },
  webServer: { command: "npm run start", url: "http://127.0.0.1:3000", reuseExistingServer: false, timeout: 60_000 }
});
