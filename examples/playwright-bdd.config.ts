import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";
import { testTimeoutMs } from "./support/timing.js";

// bddgen turns the feature files into specs under outputDir; Playwright runs those.
const testDir = defineBddConfig({
  features: "bdd/features/*.feature",
  steps: "bdd/steps/*.ts",
  outputDir: "bdd/.features-gen",
});

export default defineConfig({
  testDir,
  timeout: testTimeoutMs,
  workers: 1,
  reporter: [
    ["list"],
    [
      "semantic-assert-playwright/reporter",
      { outputFile: "test-results/semantic-assert-metrics-bdd.json" },
    ],
  ],
  use: { browserName: "chromium", headless: true },
});
