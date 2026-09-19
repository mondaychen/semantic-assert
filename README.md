# semantic-assert

Assert plain-English claims about captured state, with a model as the judge.
Batch claims into one request, retry while state changes, and keep thresholds,
pass/fail decisions, and usage metrics in code.

## Packages

| Package                                                           | Purpose                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [semantic-assert](packages/semantic-assert)                       | Provider interface, polling judge, settings, metrics, and deterministic fake provider; no runtime dependencies |
| [semantic-assert-typesafe](packages/semantic-assert-typesafe)     | TypeSafe Jev provider                                                                                          |
| [semantic-assert-ai-sdk](packages/semantic-assert-ai-sdk)         | Vercel AI SDK evaluation provider, with Jev through AI Gateway                                                 |
| [semantic-assert-playwright](packages/semantic-assert-playwright) | Page capture, visual hints, fixtures, matchers, and usage reporter                                             |

Each package ships ESM, CommonJS, and TypeScript declarations and can be installed
and versioned independently. Node.js 22 or newer is supported. The Playwright
adapter requires `@playwright/test >=1.50.0` as a peer dependency.

## Try it without an API key

After the first npm release:

```sh
pnpm add semantic-assert
```

```ts
import { FakeProvider, Judge, resolveJudgeSettings } from "semantic-assert";

const judge = new Judge({
  provider: new FakeProvider({ scripts: [{ claim_0: 0.95 }] }),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
  hooks: { wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
});

await judge.expectClaims(
  async () => ({ message: "Your changes have been saved." }),
  [{ claim: "The message confirms success" }],
);
```

`FakeProvider` returns scripted answers; it does not evaluate language.

## Try it with an API key

Use Jev through TypeSafe for real judgments. After the first npm release:

```sh
pnpm add semantic-assert semantic-assert-typesafe
export TYPESAFE_API_KEY="your-api-key"
```

Save this as `check.mjs`:

```js
import { Judge, noul, resolveJudgeSettings } from "semantic-assert";
import { typesafe } from "semantic-assert-typesafe";

const judge = new Judge({
  provider: typesafe(),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
  hooks: { wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
});

await judge.expectClaims(
  async () => ({ message: "Your changes have been saved." }),
  [{ claim: "The message confirms success" }],
  {
    timeoutMs: 0, // Judge this static response once.
    template: (claim) =>
      noul({
        statement: claim,
        question: "Is the statement supported by the supplied JSON state?",
      }),
  },
);
console.log("Semantic assertion passed.");
```

Run `node check.mjs`. If your key is in `.env`, use
`node --env-file=.env check.mjs` instead. The custom template above describes
JSON data; the built-in template describes captured web pages.

To use Vercel AI Gateway instead, install its adapter and set your Gateway key:

```sh
pnpm add semantic-assert semantic-assert-ai-sdk
export AI_GATEWAY_API_KEY="your-api-key"
```

Replace the `typesafe` import with `import { aiSdk } from "semantic-assert-ai-sdk"`
and use `provider: aiSdk()` in the same example. It defaults to `typesafe-ai/jev`.
See the [AI SDK provider guide](packages/semantic-assert-ai-sdk/README.md) for options
and the [Playwright guide](packages/semantic-assert-playwright/README.md) for UI tests.

To try the checked-out repository before publication, follow the
[runnable examples guide](examples/README.md). With `AI_GATEWAY_API_KEY` in the
root `.env`, run `pnpm install`, `pnpm exec playwright install chromium`, and
`pnpm examples:gateway --smoke` to try five core and browser tests using at most
five API requests.

Assertions send captured state to the configured provider. Use the Playwright
adapter's `redact` hook to remove sensitive data. Keep API keys server-side.
Model judgments are probabilistic: calibrate thresholds for your provider and
use ordinary assertions for exact strings, counting, and arithmetic.

## Examples

See the [runnable examples](examples/README.md) for generated-response checks,
background-job polling, ticket classification, failure evidence, and Playwright
tests for checkout, error messages, search states, and document highlights.
Run `pnpm examples:core` or `pnpm examples:playwright` after installing workspace
dependencies (and Chromium for browser examples). Both default to scripted
providers with no API key; the guide also shows how to opt into TypeSafe or AI Gateway.
`pnpm examples:gateway --smoke` loads `.env` and selects five live tests, capped
at five API requests. This is a smaller starting point for free-tier users.
Run `pnpm examples:gateway` for the full suite.

## Development

Use Node.js 22+ and pnpm 10.12.1 (pinned in `packageManager`).

```sh
pnpm install
pnpm check
pnpm check:packages
pnpm exec playwright install chromium
pnpm test:integration
```

Turborepo orders builds before dependent packages' checks. `pnpm check` runs
formatting checks, builds, type checks, lint, and unit tests. `pnpm check:packages`
packs all four packages, installs their tarballs into an isolated temporary
consumer, and checks ESM, CommonJS, reporter exports, and TypeScript resolution.
It uses the installed tool versions, prefers the pnpm cache, and leaves the
temporary artifacts available for inspection.

The browser smoke test uses a local page and needs no credentials. A second
smoke test runs against TypeSafe only when `TYPESAFE_API_KEY` is set; the AI Gateway
smoke test runs only when `AI_GATEWAY_API_KEY` is set. CI runs
offline-provider checks on Node 22 and 24; a manual workflow run also exercises
TypeSafe and AI Gateway when their repository secrets are configured.

## Releases

See [RELEASING.md](RELEASING.md). Changesets tracks versions per package;
there is no fixed or linked version group. Nothing publishes automatically.

## License

[Apache License 2.0](LICENSE).
