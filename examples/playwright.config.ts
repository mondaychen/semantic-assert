import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",
  timeout: 60_000,
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
