# Runnable examples

These examples use the public package imports and local sample data. They cover
meaning-based assertions while keeping exact IDs, statuses, and counts in ordinary
assertions. The core examples use Node's test runner; the UI examples use Chromium
and local HTML, so no application server is needed.

## Run without an API key

From the repository root, with Node.js 22+ and pnpm 10.12.1:

```sh
pnpm install
pnpm examples:core
pnpm exec playwright install chromium
pnpm examples:playwright
```

The default is `FakeProvider`: its answers are scripted, **not evaluations of the
sample content**. This mode demonstrates API usage, polling, evidence, and metrics
deterministically. A passing fake example does not prove that its claim is true.
Fake token counts are sample values, and cost is unknown.

## Choose a use case

| Example                                                         | What it demonstrates                                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Generated support response](core/generated-response.test.ts)   | Batch positive and negative claims, per-claim thresholds, ordinary assertions, and usage totals |
| [Background export](core/polling.test.ts)                       | Re-capture changing JSON and use `NotReadyError` while state is unavailable                     |
| [Ticket routing and search](core/classification.test.ts)        | Mix typed `choice` and `noul` questions; wait for settled classifications and check the result  |
| [Failure evidence](core/failure-evidence.test.ts)               | Catch `SemanticAssertionError`, inspect probabilities, and attach judged state                  |
| [Checkout and error messages](playwright/checkout.spec.ts)      | Extend Playwright fixtures, interact with a page, batch claims, scope capture, and redact data  |
| [Search page classification](playwright/classification.spec.ts) | Distinguish loading, results, empty, and error states                                           |
| [Document styling](playwright/visual-matchers.spec.ts)          | Locator matchers, negative claims, and visual hints for highlights and struck-through text      |

The shared [JSON judge](support/json-judge.ts) supplies templates that reference
arbitrary JSON. The library's built-in templates refer to web-page fields such as
`aria_snapshot`; replace them when judging your own data. The
[provider helper](support/provider.ts) selects fake, TypeSafe, or AI SDK explicitly.

## Run with TypeSafe

Set `TYPESAFE_API_KEY` in your shell, then opt into live judgments:

```sh
EXAMPLE_PROVIDER=typesafe pnpm examples:core
EXAMPLE_PROVIDER=typesafe pnpm examples:playwright
```

These commands send the sample state to TypeSafe and incur provider usage. The
failure-evidence example always uses a fake so its deliberate failure remains
deterministic. Live judgments can differ from scripted results; calibrate the
thresholds against your own examples.

After building, run an individual file from the repository root:

```sh
pnpm --filter semantic-assert-examples exec node --test dist/core/generated-response.test.js
pnpm --filter semantic-assert-examples test:playwright checkout.spec.ts
```

## Run through Vercel AI Gateway

Set `AI_GATEWAY_API_KEY` and select the AI SDK provider. It uses the same Jev
evaluation model through Vercel's Gateway:

```sh
EXAMPLE_PROVIDER=ai-sdk pnpm examples:core
EXAMPLE_PROVIDER=ai-sdk pnpm examples:playwright
```

If the key is in the repository's `.env`, build once and let Node load that file
for each runner (these commands run from the repository root):

```sh
pnpm build
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env --test --test-concurrency=1 examples/dist/core/*.test.js
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts
```

Live requests require an enabled AI Gateway account and incur provider usage.
The Gateway provider reports cost only when explicit pricing is configured, so
the default examples show `n/a`. Choice confidence is the selected option's
probability; it differs from the direct TypeSafe provider's native confidence.
The failure-evidence example continues to use a scripted provider.

### Try five tests on the free tier

With `AI_GATEWAY_API_KEY` in the root `.env`, run this small selection first:

```sh
pnpm examples:gateway --smoke
```

It runs five tests: ticket routing, response quality, checkout, error-message
redaction, and document highlighting. Each test makes one API request, batching
related claims. The complete run uses **five API requests**.

Install Chromium with `pnpm exec playwright install chromium` before running
browser examples. Recent requests to the same model also count toward your
account's rate limit.

### Run the full suite

With the key in `.env`, run all core and browser examples:

```sh
pnpm examples:gateway
```

If you encounter rate limits on the free tier, opt into a pause before every
live evaluation, including each polling attempt. Set the delay in milliseconds
(0–300000; defaults to zero):

```sh
EXAMPLE_REQUEST_DELAY_MS=60000 pnpm examples:gateway
```

`EXAMPLE_REQUEST_DELAY_MS` also works with the individual example commands for
either live provider. When invoking Node directly, include `--test-concurrency=1`.
Run one live suite at a time to keep requests within your account's rate limit.

The example delay is a starting point, not a guaranteed limit. Vercel does not
publish fixed per-model numbers; if a run still gets a `429`, wait for the limit
to recover or increase the delay. See [Gateway rate limits](https://vercel.com/docs/ai-gateway/rate-limits).

## Adapt an example

Replace local JSON with your service's response, or `page.setContent` with
`page.goto` and real interactions. Keep capture inside the callback when state
changes. Use `timeoutMs: 0` for a single judgment of immutable output; retrying an
unchanged response adds provider calls without providing new evidence.

`expectClaims` enforces its thresholds. `evaluate` returns answers without an
acceptance policy. `classify` and `classifyPage` return the last answer on timeout,
even when it is not in `settled`: explicitly check the chosen option and any
confidence threshold your application requires.

The [Playwright configuration](playwright.config.ts) enables the usage reporter.
It prints totals and writes `examples/test-results/semantic-assert-metrics.json`.
Fixtures and matchers attach judgment evidence; failed claims also attach the
captured state. Redact sensitive fields before submitting real data.

`pnpm check` builds, type-checks, and runs the core examples. Browser examples run
separately with `pnpm examples:playwright` and in CI after Chromium is installed.
