---
title: Core assertions
description: Capture JSON, batch claims, configure thresholds and polling, and inspect semantic assertion failures.
---

# Core assertions

The `semantic-assert` package is the judge itself. It knows nothing about browsers,
test runners, or model vendors, and it has no runtime dependencies. You give it a
provider that answers questions, and it handles thresholds, polling, and metrics.

::: info You will learn

- How to create a judge and assert claims about JSON
- How negative claims and per-claim thresholds work
- How to write claims the model can judge well
- When and how to poll changing state
- How to classify state into named options
- What a failure gives you to work with

:::

## Create a judge

Pair a provider with settings:

```ts
import { Judge, resolveJudgeSettings } from "semantic-assert";
import { typesafe } from "semantic-assert-typesafe";

const judge = new Judge({
  provider: typesafe(),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
});
```

`resolveJudgeSettings` layers your overrides over environment variables and
built-in defaults. The full list is in [providers and configuration](./providers#judge-settings).

## Assert claims

Call `expectClaims` with a function that returns the state to judge and a list of
claims about it:

```ts
await judge.expectClaims(
  async () => ({ message: "The file is too large. Choose a smaller file and try again." }),
  [
    { claim: "The message explains why the upload failed" },
    { claim: "The message tells the user how to recover" },
  ],
);
```

Every claim in one call shares the same captured state and the same provider
request, so batching related claims costs no more than asking one. The call
resolves when every claim passes and throws `SemanticAssertionError` otherwise.

By default that's a single evaluation (`timeoutMs: 0`). A positive timeout opts
into repeated captures and evaluations until every claim passes or time runs out.

### Negative claims

Set `expected: false` when the claim describes something that must not be true:

```ts
{ claim: "The reply promises a refund", expected: false, threshold: 0.9 }
```

At a threshold of `0.9`, a positive claim needs a probability of at least `0.9`.
A negative claim needs a probability of at most `1 - 0.9`, so `0.1`.

::: warning Pitfall
A low score on a positive claim isn't strong evidence for its opposite. If you
need the model to confirm that something is absent, write that as a negative
claim rather than reading a failed positive claim backwards.
:::

### Write claims the model can judge

- **Name the subject.** “The alert asks the user to try again” beats “it asks to try again.”
- **One condition per claim.** When a claim fails, you'll know exactly which behavior is missing.
- **Put the context in the state.** If a claim refers to the customer's question, capture the question alongside the reply.
- **Leave exact facts to code.** Strings, IDs, counts, and arithmetic belong in ordinary assertions.

## Poll changing state

Capture inside the callback so each poll sees the current state, and set a
positive `timeoutMs`:

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

The judge recaptures and re-evaluates until every claim passes or the deadline
arrives. Each poll is one provider request.

When the state can't be captured yet, throw `NotReadyError` from the callback.
With polling on, the judge waits and tries again. At the default zero timeout,
the error goes straight to you without a model call.

::: details Deep dive: the capture context
Your callback receives a context object. While polling, its `pollingDeadline` is
the epoch time when polling stops. A capture that waits for its own target, such
as a locator, can cap that wait so it never outlasts the assertion. The Playwright
adapter uses this for its region wait.
:::

::: warning Pitfall
`timeoutMs` bounds polling, not a single provider request. A request already in
flight finishes under the provider's own timeout and retry settings, so it can
complete after the polling deadline. Configure the provider's request timeout and
retries, and give your test runner room for both.
:::

## Classify state

Use `classify` when the question is “which of these is it?” rather than “is this
true?”:

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

`classify` evaluates once by default and returns the chosen option with its
confidence. With a positive `timeoutMs`, `settled` lists the options that end
polling: the judge keeps recapturing while the answer is `loading`, and stops as
soon as it sees `empty` or `listed`.

::: warning Pitfall
`classify` never fails a test on its own. At the default zero timeout it returns
its first answer even if that answer isn't settled, and with polling it returns
the last answer on timeout. Always assert `result.choice` and any confidence
requirement yourself.
:::

## Failure evidence and usage

When a claim misses, `SemanticAssertionError.results` lists every claim with its
expectation, probability, threshold, and pass/fail decision. Pass a `hooks.attach`
function when you create the judge to receive that evidence for your test report.
The Playwright fixture wires this up for you.

Read usage at any time:

```ts
console.log(judge.metrics.totals);
```

Metrics include calls, questions, input and output tokens, and time spent waiting
on the provider. Cost is an estimate from rates you configure on the provider,
and stays unknown until you set them.

## Recap

- `expectClaims` batches claims about one captured state into one request and throws when a claim misses.
- Negative claims need `expected: false`; a failed positive claim isn't the same thing.
- Polling is opt-in with a positive `timeoutMs`. Throw `NotReadyError` when there's nothing to judge yet.
- `classify` returns an answer; you decide whether it's the right one.
- Failures carry per-claim results, and metrics track what each judgment cost.

For the provider interface and `evaluate`, which returns raw answers without an
acceptance policy, see the
[source reference](https://github.com/mondaychen/semantic-assert/tree/main/packages/semantic-assert).
