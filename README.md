# semantic-assert

Assert plain-English claims about captured state, with a model as the judge.
Batch claims into one request, poll changing state when you ask for it, and keep
thresholds, pass/fail decisions, and usage metrics in code.

**[Documentation](https://mengdi.dev/semantic-assert/)** ·
[Quick start](https://mengdi.dev/semantic-assert/getting-started.html) ·
[HTML and Playwright](https://mengdi.dev/semantic-assert/examples/html-alerts.html)

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

## Installation

```sh
pnpm add semantic-assert semantic-assert-typesafe
```

Follow the [quick start](https://mengdi.dev/semantic-assert/getting-started.html)
for provider setup and your first assertion. The docs include before-and-after
examples for [HTML alerts after copy edits](https://mengdi.dev/semantic-assert/examples/html-alerts.html)
and [generated support replies](https://mengdi.dev/semantic-assert/examples/generated-replies.html).
For tests you can run from this checkout, see the [examples guide](examples/README.md).

Model judgments are probabilistic. Keep exact strings, counting, and arithmetic
in ordinary assertions, and calibrate thresholds against your own examples.
Captured state is sent to the configured provider; redact sensitive data and
keep API keys server-side.

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
offline-provider checks on Node 22 and 24; a nightly schedule and manual
workflow runs also exercise TypeSafe and AI Gateway when their repository
secrets are configured.

## Documentation development

```sh
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

Docs live in `docs/`. The Documentation workflow checks pull requests and publishes
changes on `main` to GitHub Pages. The production base path is `/semantic-assert/`.

## Releases

See [RELEASING.md](RELEASING.md). Changesets tracks versions per package;
there is no fixed or linked version group. Nothing publishes automatically.

## License

[Apache License 2.0](LICENSE).
