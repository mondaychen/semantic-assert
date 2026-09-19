import { defineConfig } from "@playwright/test";
import { testTimeoutMs } from "./support/timing.js";

export default defineConfig({
  testDir: "./playwright",
  timeout: testTimeoutMs,
  workers: 1,
  reporter: [
    ["list"],
    [
      "semantic-assert-playwright/reporter",
      { outputFile: "test-results/semantic-assert-metrics.json" },
    ],
  ],
  use: { browserName: "chromium", headless: true },
});
