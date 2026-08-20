import { defineConfig, devices } from "@playwright/test";

const localBaseUrl = "http://127.0.0.1:4173";
const externalBaseUrl = process.env.METERMESH_E2E_BASE_URL?.trim();

export default defineConfig({
  ...(externalBaseUrl === undefined
    ? {
        webServer: {
          command: "pnpm preview --host 127.0.0.1 --port 4173",
          reuseExistingServer: false,
          timeout: 60_000,
          url: localBaseUrl,
        },
      }
    : {}),
  expect: { timeout: 5_000 },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  reporter: "list",
  retries: 0,
  testDir: "./e2e",
  use: {
    baseURL: externalBaseUrl ?? localBaseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  workers: 1,
});
