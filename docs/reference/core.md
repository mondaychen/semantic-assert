---
title: Core assertions
description: Capture JSON, batch claims, configure thresholds and polling, and inspect semantic assertion failures.
---

# Core assertions

`semantic-assert` is independent of browsers, test runners, and model vendors.
The core has no runtime dependencies. A provider evaluates questions; the judge
handles thresholds, polling, and metrics.

## Create a judge

```ts
import { Judge, resolveJudgeSettings } from "semantic-assert";
import { typesafe } from "semantic-assert-typesafe";

const judge = new Judge({
  provider: typesafe(),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
});
```

## Assert claims

The capture callback returns JSON. All claims in one invocation share the same
captured state and provider request.

```ts
await judge.expectClaims(
  async () => ({ message: "The file is too large. Choose a smaller file and try again." }),
  [
    { claim: "The message explains why the upload failed" },
    { claim: "The message tells the user how to recover" },
  ],
);
```

The default is one evaluation (`timeoutMs: 0`). The call resolves when every claim
passes, and throws `SemanticAssertionError` otherwise. A positive timeout opts into
repeated captures and evaluations until all claims pass or polling ends.

### Negative claims

```ts
{ claim: "The reply promises a refund", expected: false, threshold: 0.9 }
```

At a threshold of `0.9`, a positive claim needs a returned probability of at least
`0.9`. A negative claim needs a probability of at most `1 - 0.9` (`0.1`). A low score
on a positive claim is not automatically strong evidence for its opposite.

### Write observable claims

- Name the relevant subject: “The alert asks the user to try again.”
- Keep one condition per claim so failures identify the missing behavior.
- Include relevant context in captured state, such as the customer's question.
- Use ordinary assertions for exact strings, IDs, counts, and arithmetic.

## Poll changing state

Capture inside the callback so each poll sees current state:

```ts
await judge.expectClaims(
  async () => {
    const response = await fetch("http://localhost:3000/jobs/1042");
    return response.json();
  },
  [{ claim: "The export completed and a download is available" }],
  { timeoutMs: 10_000, pollIntervalMs: 500 },
);
```

With polling enabled, throw `NotReadyError` from the callback when the state cannot
be captured yet and the judge should try again. At the default zero timeout, that
error is returned immediately without a model call.

`timeoutMs` bounds polling, not an individual provider request. An in-flight
request can finish after the polling deadline. Set the provider's request timeout
and retries, and give your test runner enough time for both.

## Classify state

`classify` chooses among named options and evaluates once by default. When you
also set a positive `timeoutMs`, `settled` lists the options that end polling:

```ts
const result = await judge.classify(
  async () => ({ message: "No projects yet. Create your first project." }),
  "Which state does the message describe?",
  {
    loading: "Projects are still loading.",
    empty: "There are no projects and the user can create one.",
    listed: "Existing projects are listed.",
  },
  { settled: ["empty", "listed"] },
);
```

At the default zero timeout, `classify` returns its first answer even if its choice
is not settled. With polling enabled, it returns the last answer on timeout.
Assert `result.choice` and any confidence requirement in your own code.

## Failure evidence and usage

`SemanticAssertionError.results` contains the claims, expectations, probabilities,
thresholds, and pass/fail decisions. An optional `hooks.attach` function on the
judge receives evidence for your test report. The Playwright fixture wires this
up automatically.

```ts
console.log(judge.metrics.totals);
```

Metrics include calls, questions, input/output tokens, and provider wait time.
Cost is an estimate from rates configured on the provider; it is unknown until
those rates are set.

See the [source reference](https://github.com/mondaychen/semantic-assert/tree/main/packages/semantic-assert)
for the provider interface and `evaluate`, which returns answers without enforcing
an acceptance policy.
