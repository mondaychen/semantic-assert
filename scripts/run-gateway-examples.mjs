import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = new URL("../.env", import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(fileURLToPath(envFile));
if (!process.env.AI_GATEWAY_API_KEY)
  throw new Error("Set AI_GATEWAY_API_KEY in .env or your shell");

const env = {
  ...process.env,
  EXAMPLE_PROVIDER: "ai-sdk",
  EXAMPLE_REQUEST_DELAY_MS: process.env.EXAMPLE_REQUEST_DELAY_MS ?? "0",
};
const coreTests = readdirSync(new URL("../examples/dist/core/", import.meta.url))
  .filter((file) => file.endsWith(".test.js"))
  .sort()
  .map((file) => `examples/dist/core/${file}`);

// Separate test processes and separate suites must not compete for the same quota.
for (const args of [
  ["--test", "--test-concurrency=1", ...coreTests],
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config=examples/playwright.config.ts",
    "--workers=1",
    "--max-failures=1",
  ],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
