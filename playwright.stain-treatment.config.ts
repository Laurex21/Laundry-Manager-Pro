import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { requireSafeTestDatabaseUrl, schemaConnectionEnv } from "./scripts/seed-stain-treatment-e2e";

const testUrl = requireSafeTestDatabaseUrl();
const schema = process.env.STAIN_E2E_SCHEMA || `stain_e2e_${randomBytes(12).toString("hex")}`;
const port = Number(process.env.STAIN_E2E_PORT || 41_000 + (randomBytes(2).readUInt16BE(0) % 10_000));
const baseURL = `http://127.0.0.1:${port}`;
// Global setup runs in the Playwright process, so pin the exact same schema used by webServer.
process.env.STAIN_E2E_SCHEMA = schema;
process.env.STAIN_E2E_BASE_URL = baseURL;
const webServerEnv = Object.fromEntries(
  Object.entries({
    ...schemaConnectionEnv(testUrl, schema),
    PORT: String(port),
    STAIN_E2E_BASE_URL: baseURL,
    STAIN_E2E_SCHEMA: schema,
  }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "stain-treatment.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 45_000,
  globalSetup: "./e2e/stain-treatment.setup.ts",
  globalTeardown: "./e2e/stain-treatment.teardown.ts",
  outputDir: "artifacts/stain-treatment-e2e/test-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/stain-treatment-e2e/results.json" }],
    ["html", { outputFolder: "artifacts/stain-treatment-e2e/html", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
    env: webServerEnv,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-320", use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true } },
  ],
});
