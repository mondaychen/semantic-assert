# semantic-assert

Assert plain-English claims about captured state, with a model as the judge.
Batch claims into one request, retry while state changes, and keep thresholds,
pass/fail decisions, and usage metrics in code.

## Packages

| Package                                                           | Purpose                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [semantic-assert](packages/semantic-assert)                       | Provider interface, polling judge, settings, metrics, and deterministic fake provider; no runtime dependencies |
| [semantic-assert-typesafe](packages/semantic-assert-typesafe)     | TypeSafe Jev provider                                                                                          |
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

`FakeProvider` returns scripted answers; it does not evaluate language. For real
judgments, install `semantic-assert-typesafe`, set `TYPESAFE_API_KEY` in your
server/test environment, and replace the fake provider with `typesafe()`.
See the [Playwright guide](packages/semantic-assert-playwright/README.md) for UI tests.

Assertions send captured state to the configured provider. Use the Playwright
adapter's `redact` hook to remove sensitive data. Keep API keys server-side.
Model judgments are probabilistic: calibrate thresholds for your provider and
use ordinary assertions for exact strings, counting, and arithmetic.

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
packs all three packages, installs their tarballs into an isolated temporary
consumer, and checks ESM, CommonJS, reporter exports, and TypeScript resolution.
It uses the installed tool versions, prefers the pnpm cache, and leaves the
temporary artifacts available for inspection.

The browser smoke test uses a local page and needs no credentials. A second
smoke test runs against TypeSafe only when `TYPESAFE_API_KEY` is set. CI runs
offline-provider checks on Node 22 and 24; a manual workflow run also exercises
TypeSafe when the repository secret is configured.

## Releases

See [RELEASING.md](RELEASING.md). Changesets tracks versions per package;
there is no fixed or linked version group. Nothing publishes automatically.

## License

[Apache License 2.0](LICENSE).
