# semantic-assert

Provider-agnostic core for semantic assertions: plain-English claims about
JSON state, answered as typed yes/no probabilities and multiple-choice
distributions, with polling, thresholds and usage metrics. It knows nothing
about browsers, test runners or model vendors. Providers and adapters plug in:

| Package                      | Role                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `semantic-assert`            | this package: types, `Judge`, settings, metrics                |
| `semantic-assert-typesafe`   | provider for TypeSafe's Jev (System One)                       |
| `semantic-assert-ai-sdk`     | Vercel AI SDK evaluation provider, including Jev on AI Gateway |
| `semantic-assert-playwright` | Playwright capture, fixture, matchers, usage reporter          |

## Provider interface

```ts
interface Provider {
  readonly name: string;
  evaluate<Q extends Questions>(state: JsonValue, questions: Q): Promise<ProviderResult<Q>>;
}
```

A provider answers Noul (yes/no probability) and Choice (option distribution
plus confidence) questions about one state, all questions in one call, and
reports the model id, token usage and, when it has rates to estimate from, its
cost. `FakeProvider` ships here
for tests: scripted answers per call, and it records every request.

## Judge

```ts
import { Judge, resolveJudgeSettings } from "semantic-assert";
import { typesafe } from "semantic-assert-typesafe";

const judge = new Judge({
  provider: typesafe(),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
  // hooks are optional: `wait` defaults to a timer, `attach` receives evidence.
});

// Captures and evaluates once by default.
await judge.expectClaims(
  async () => ({ body: await fetchResponse() }),
  [
    { claim: "the error message tells the user what to do next" },
    { claim: "the response mentions a refund", expected: false, threshold: 0.9 },
  ],
);
```

`expectClaims` and `classify` capture and evaluate once by default (`timeoutMs: 0`).
To opt into polling, set a positive `timeoutMs` per call or in judge settings.
Then `expectClaims` re-captures until every claim passes or polling times out;
`classify` polls until the chosen option is listed in `settled` or polling times out.
`NotReadyError` retries capture only when polling is enabled and time remains.
`classify` returns its last answer even if it is not settled, so assert the result.
`evaluate` asks arbitrary questions once. Every judgment is handed to the optional
`attach` hook for the test report.

`timeoutMs` bounds polling, not a single provider request. A request already
in flight finishes under the provider's own timeout and retry settings, so
the worst case is one provider call past the deadline. Configure those on
the provider (`timeoutMs` and `maxRetries` on both bundled providers) and
keep your test runner's timeout above the sum.

## Settings

`resolveJudgeSettings(overrides)`: explicit overrides, then
`SEMANTIC_ASSERT_THRESHOLD`, `SEMANTIC_ASSERT_TIMEOUT_MS`,
`SEMANTIC_ASSERT_POLL_MS`, `SEMANTIC_ASSERT_MAX_STATE_CHARS`, then defaults of
0.7, 0 (no polling), 1 s and 40,000 characters. Thresholds must be in [0.5, 1]. The
question templates that wrap a claim are part of the settings. The defaults
describe arbitrary JSON state; adapters that capture a known layout (such as
the Playwright package) supply templates naming its fields, and any template
can be replaced per provider or language.

## Calibration

Thresholds assume the provider returns calibrated probabilities, which is what
System One models are trained for. An LLM asked for a probability is not
calibrated, so tune thresholds per provider and treat the numbers from
different providers as different scales.

## Writing claims

Models read claims literally and are weak at exact string comparison and
counting. Write the observable condition, one per claim, and prefer the
semantic question ("the panel shows the session named in `chosen_session`")
over equality ("has the same title as"). Keep anything code can decide exactly
in code.

## Tests

```bash
pnpm --filter semantic-assert test
```

Only `process.env` is assumed from the runtime; everything else is standard
`fetch`-era JavaScript, so the core also runs on Bun, Deno and edge runtimes.
