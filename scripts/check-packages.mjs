import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const consumer = mkdtempSync(join(tmpdir(), "semantic-assert-consumer-"));
const run = (command, args, cwd = consumer) =>
  execFileSync(command, args, { cwd, stdio: "inherit" });
const names = [
  "semantic-assert",
  "semantic-assert-typesafe",
  "semantic-assert-playwright",
  "semantic-assert-ai-sdk",
];
const tarballs = [];
for (const name of names) {
  const cwd = resolve(root, "packages", name);
  const manifest = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
  run("pnpm", ["pack", "--pack-destination", consumer], cwd);
  const tarball = join(consumer, `${name}-${manifest.version}.tgz`);
  tarballs.push(tarball);
  const packed = JSON.parse(
    execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }),
  );
  assert.equal(packed.private, undefined);
  assert.equal(packed.license, "Apache-2.0");
  assert.equal(packed.repository?.directory, `packages/${name}`);
  assert.ok(packed.homepage && packed.bugs?.url, `Missing homepage or bugs URL in ${name}`);
  assert.equal(
    execFileSync("tar", ["-xOf", tarball, "package/LICENSE"], { encoding: "utf8" }),
    readFileSync(join(root, "LICENSE"), "utf8"),
  );
  for (const version of Object.values(packed.dependencies ?? {})) {
    assert(!/^(workspace:|file:|link:)/.test(version), `Unresolved dependency in ${name}`);
  }
  const entries = execFileSync("tar", ["-tf", tarball], { encoding: "utf8" }).trim().split("\n");
  assert(entries.includes("package/LICENSE"));
  assert(entries.includes("package/README.md"));
  assert(entries.includes("package/CHANGELOG.md"));
  assert(
    entries.every((entry) =>
      /^package\/(dist\/|package.json$|README.md$|CHANGELOG.md$|LICENSE$)/.test(entry),
    ),
  );
  assert(entries.every((entry) => !entry.includes(".test.")));
  for (const conditions of Object.values(packed.exports)) {
    for (const target of Object.values(conditions)) {
      for (const path of Object.values(target))
        assert(entries.includes(`package/${path.slice(2)}`));
    }
  }
}
// Resolve the unpublished core from its tarball, including transitive consumers.
writeFileSync(
  join(consumer, "package.json"),
  JSON.stringify({
    private: true,
    type: "module",
    pnpm: { overrides: { "semantic-assert": `file:${tarballs[0]}` } },
  }),
);
const installedVersion = (name, from = root) =>
  JSON.parse(readFileSync(join(from, "node_modules", name, "package.json"), "utf8")).version;
run("pnpm", [
  "add",
  "--prefer-offline",
  "--ignore-scripts",
  ...tarballs,
  // Peer of the AI SDK adapter: the consumer must supply it.
  `ai@${installedVersion("ai", resolve(root, "packages", "semantic-assert-ai-sdk"))}`,
  `@playwright/test@${installedVersion("@playwright/test")}`,
  `typescript@${installedVersion("typescript")}`,
  `@types/node@${installedVersion("@types/node")}`,
]);
const runtime = `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const load of [(name) => import(name), async (name) => require(name)]) {
  const core = await load('semantic-assert');
  const { typesafe } = await load('semantic-assert-typesafe');
  const { aiSdk } = await load('semantic-assert-ai-sdk');
  const adapter = await load('semantic-assert-playwright');
  const reporter = await load('semantic-assert-playwright/reporter');
  assert.equal(typeof typesafe, 'function');
  const remote = typesafe({
    apiKey: 'test',
    fetch: async (_url, init) => {
      assert.ok(new Headers(init.headers).get('x-typesafe-sdk').startsWith('typesafe-sdk/'));
      return new Response(JSON.stringify({
        model: 'test-model',
        answers: { claim_0: { type: 'noul', noul: 0.99 } },
        usage: { input_tokens: 100, output_tokens: 1 },
      }));
    },
  });
  const evaluation = await remote.evaluate('Saved', { claim_0: core.noul('The operation succeeded') });
  assert.equal(evaluation.answers.claim_0.noul, 0.99);
  assert.equal(evaluation.attempts, 1);
  const gatewayProvider = aiSdk({
    gateway: {
      apiKey: 'test',
      fetch: async () => Response.json({
        answers: { claim_0: { type: 'boolean', probability: 0.99 } },
        usage: { inputTokens: 100, outputTokens: 1 },
      }),
    },
  });
  const gatewayResult = await gatewayProvider.evaluate('Saved', { claim_0: core.noul('The operation succeeded') });
  assert.equal(gatewayResult.answers.claim_0.noul, 0.99);
  assert.equal(gatewayResult.attempts, 1);
  assert.equal(typeof adapter.PageJudge, 'function');
  assert.equal(typeof reporter.default, 'function');
  assert.equal(adapter.Judge, core.Judge);
  const provider = new core.FakeProvider({ scripts: [{ claim_0: 0.99 }] });
  const judge = new core.Judge({ provider, settings: core.resolveJudgeSettings() });
  const [result] = await judge.expectClaims(async () => ({ message: 'Saved' }), [{ claim: 'The operation succeeded' }]);
  assert.equal(result.passed, true);
}
`;
writeFileSync(join(consumer, "smoke.mjs"), runtime);
run("node", ["smoke.mjs"]);
const types = `
import { FakeProvider, Judge, resolveJudgeSettings, type Provider } from 'semantic-assert';
import { typesafe } from 'semantic-assert-typesafe';
import { aiSdk, type AiSdkProviderOptions } from 'semantic-assert-ai-sdk';
import { PageJudge, judgeFixtures, createJudgeExpect } from 'semantic-assert-playwright';
import UsageReporter from 'semantic-assert-playwright/reporter';
const provider: Provider = typesafe({ apiKey: 'test' });
const sdkOptions: AiSdkProviderOptions = { model: 'typesafe-ai/jev' };
const sdkProvider: Provider = aiSdk(sdkOptions);
new Judge({ provider: new FakeProvider(), settings: resolveJudgeSettings() });
void [provider, sdkProvider, PageJudge, judgeFixtures, createJudgeExpect, UsageReporter];
`;
for (const extension of ["mts", "cts"]) {
  writeFileSync(join(consumer, `consumer.${extension}`), types);
  run("pnpm", [
    "exec",
    "tsc",
    "--noEmit",
    "--strict",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    `consumer.${extension}`,
  ]);
}
console.log(
  `All packed packages passed ESM, CommonJS, and TypeScript consumer checks. Artifacts: ${consumer}`,
);
