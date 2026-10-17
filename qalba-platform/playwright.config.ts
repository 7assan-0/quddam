import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./scripts/e2e-warmup.ts",
  reporter: process.env.E2E_REPORT_FILE ? [["list"], ["json", { outputFile: process.env.E2E_REPORT_FILE }]] : undefined,
  timeout: 60_000,
  workers: process.env.E2E_DATABASE_URL ? 1 : undefined,
  use: {
    baseURL: "http://127.0.0.1:3000", ...devices["Desktop Chrome"],
    launchOptions: {
      // Existing tests mix UI clicks with immediate raw API commands. Human-paced
      // browser actions let the click's async mutation settle before the next RPC;
      // Promise.all commands and all server assertions remain unchanged.
      slowMo: process.env.E2E_DATABASE_URL ? 100 : 0,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] }
        : {}),
    },
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI && !process.env.E2E_DATABASE_URL,
    timeout: 90_000,
    env: { DATABASE_URL: process.env.E2E_DATABASE_URL || "postgresql://qalba:qalba@localhost:5432/qalba", AUTH_RATE_LIMIT_SECRET: process.env.AUTH_RATE_LIMIT_SECRET || "e2e-only-secret-do-not-use-in-production" },
  },
});
