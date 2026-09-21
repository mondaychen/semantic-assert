# semantic-assert

Assert plain-English claims about captured state, with a model as the judge.

Every exact-string assertion is a bet that nobody will touch the copy.
`semantic-assert` lets you assert what the PRD actually asks for, such as "the
alert tells the user how to recover", with a model as the judge and the pass/fail
threshold in your code.

```ts
const alert = page.getByRole("alert");
await alert.waitFor({ state: "visible" });
await judge.expectPageTo("The alert explains how to recover from the error", {
  region: alert,
});
```

**[Documentation](https://mengdi.dev/semantic-assert/)** ·
[Quick start](https://mengdi.dev/semantic-assert/getting-started.html) ·
[HTML and Playwright](https://mengdi.dev/semantic-assert/examples/html-alerts.html)

## Why a model, and why this one

Exact-string assertions break on every copy edit. Keyword checks miss paraphrases
and pass on contradictions. A semantic assertion asks the question you actually
care about, such as “does this alert tell the user how to recover?”, and gets a
probability back.

The default judge is [Jev](https://typesafe.ai), TypeSafe's first
[System One model](https://docs.typesafe.ai/concepts/system-one). Jev doesn't
generate text. It answers yes/no and multiple-choice questions about supplied
state with typed results and calibrated probabilities. That's what makes a
threshold like `0.8` meaningful: it's a probability the model was trained to get
right, not a number quoted inside prose. Jev is newer than the chat models most
test suites reach for, and it's built for exactly this kind of judgment.

You're not locked in. Anything that implements the `Provider` interface works,
and the Vercel AI SDK adapter reaches Jev through AI Gateway.

## What you get

- **One request per batch.** Related claims about the same state travel together.
- **Thresholds in code.** Per-claim, per-call, or per-suite, with negative claims for things that must not be true.
- **Single evaluation by default.** Polling is opt-in, so you never pay for retries you didn't ask for.
- **Playwright integration.** A `judge` fixture, `expect(locator).toSatisfy()` matchers, scoped captures, redaction, visual hints, and a usage reporter.
- **Evidence and metrics.** Every failure lists each claim's probability, and every run reports calls, tokens, wait time, and estimated cost.

## Packages

| Package                                                           | Purpose                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [semantic-assert](packages/semantic-assert)                       | Provider interface, polling judge, settings, metrics, and deterministic fake provider; no runtime dependencies |
| [semantic-assert-typesafe](packages/semantic-assert-typesafe)     | TypeSafe Jev provider                                                                                          |
| [semantic-assert-ai-sdk](packages/semantic-assert-ai-sdk)         | Vercel AI SDK evaluation provider, with Jev through AI Gateway                                                 |
| [semantic-assert-playwright](packages/semantic-assert-playwright) | Page capture, visual hints, fixtures, matchers, and usage reporter                                             |

Every package ships ESM, CommonJS, and TypeScript declarations, and you can install
and version each one independently. Node.js 22 or newer is required. The Playwright
adapter needs `@playwright/test >=1.50.0` as a peer dependency.

## Install

```sh
pnpm add semantic-assert semantic-assert-typesafe
```

Then follow the [quick start](https://mengdi.dev/semantic-assert/getting-started.html)
for provider setup and your first assertion. The docs walk through before-and-after
examples for [HTML alerts after copy edits](https://mengdi.dev/semantic-assert/examples/html-alerts.html)
and [generated support replies](https://mengdi.dev/semantic-assert/examples/generated-replies.html).
For tests you can run from this checkout, see the [examples guide](examples/README.md).

A few things to keep in mind:

- Model judgments are probabilistic. Keep exact strings, counting, and arithmetic in ordinary assertions, and calibrate thresholds against your own examples.
- Captured state is sent to the configured provider. Redact sensitive data and keep API keys server-side.

## Development

Use Node.js 22+ and pnpm 10.12.1, pinned in `packageManager`:

```sh
pnpm install
pnpm check
pnpm check:packages
pnpm exec playwright install chromium
pnpm test:integration
```

`pnpm check` runs formatting checks, builds, type checks, lint, and unit tests.
Turborepo orders builds ahead of each dependent package's checks.

`pnpm check:packages` packs all four packages, installs the tarballs into an
isolated temporary consumer, and checks ESM, CommonJS, reporter exports, and
TypeScript resolution. It uses the installed tool versions, prefers the pnpm
cache, and leaves the temporary artifacts in place for inspection.

The browser smoke test uses a local page and needs no credentials. A second smoke
test runs against TypeSafe only when `TYPESAFE_API_KEY` is set, and the AI Gateway
smoke test only when `AI_GATEWAY_API_KEY` is set. CI runs the offline checks on
Node 22 and 24. A nightly schedule and manual workflow runs also exercise TypeSafe
and AI Gateway when their repository secrets are configured.

### Documentation

```sh
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

Docs live in `docs/`. The Documentation workflow checks pull requests and publishes
`main` to GitHub Pages under the `/semantic-assert/` base path.

### Releases

See [RELEASING.md](RELEASING.md). Changesets tracks versions per package with no
fixed or linked group. Nothing publishes automatically.

## License

[Apache License 2.0](LICENSE).
