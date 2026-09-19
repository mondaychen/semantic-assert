import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./integration",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: { browserName: "chromium", headless: true },
});
