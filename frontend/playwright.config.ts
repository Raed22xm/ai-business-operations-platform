import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { E2E_FRONTEND_PORT, statePath } from "./e2e/env";

function baseURLFromState(): string {
  try {
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, "utf8")) as { baseURL?: string };
      if (state.baseURL) {
        return state.baseURL;
      }
    }
  } catch {
    // Fall through to default.
  }
  return `http://localhost:${E2E_FRONTEND_PORT}`;
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: require.resolve("./e2e/global-setup.ts"),
  globalTeardown: require.resolve("./e2e/global-teardown.ts"),
  use: {
    baseURL: baseURLFromState(),
    trace: "on-first-retry",
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: path.join("e2e", ".runtime", "test-results"),
});
