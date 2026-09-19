import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--smoke")) {
  throw new Error("Usage: pnpm examples:gateway [--smoke]");
}
const smoke = args.includes("--smoke");
const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = new URL("../.env", import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(fileURLToPath(envFile));
if (!process.env.AI_GATEWAY_API_KEY)
  throw new Error("Set AI_GATEWAY_API_KEY in .env or your shell");

const env = {
  ...process.env,
  EXAMPLE_PROVIDER: "ai-sdk",
  EXAMPLE_REQUEST_DELAY_MS: smoke ? "0" : (process.env.EXAMPLE_REQUEST_DELAY_MS ?? "0"),
  EXAMPLE_SINGLE_PASS: smoke ? "1" : "0",
};

// Each selected test contains exactly one evaluation. Keep the list explicit:
// polling examples and SDK/test retries would spend more than five requests.
const coreSmokeNames = [
  "route a support ticket using typed questions in one request",
  "a support response explains the next step without inventing a refund",
];
const browserSmokeNames = [
  "checkout confirms the purchase and explains what happens next",
  "redact account data before judging an error message",
  "a document highlights the cited passage and marks obsolete guidance",
];
const coreFiles = smoke
  ? ["classification.test.js", "generated-response.test.js"]
  : readdirSync(new URL("../examples/dist/core/", import.meta.url))
      .filter((file) => file.endsWith(".test.js"))
      .sort();
const coreTests = coreFiles.map((file) => `examples/dist/core/${file}`);

if (smoke) console.log("Gateway smoke run: five tests, up to five API requests.");

// Separate test processes and separate suites must not compete for the same quota.
for (const args of [
  [
    "--test",
    "--test-concurrency=1",
    ...(smoke ? [`--test-name-pattern=^(${coreSmokeNames.join("|")})$`] : []),
    ...coreTests,
  ],
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config=examples/playwright.config.ts",
    "--workers=1",
    "--max-failures=1",
    ...(smoke
      ? ["--grep", `(${browserSmokeNames.join("|")})$`, "--retries=0", "--repeat-each=1"]
      : []),
  ],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
