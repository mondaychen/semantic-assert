---
title: Introduction
description: Assert the meaning of generated responses and HTML pages, with plain-English claims and a model as the judge.
---

# Test what your app means.

Copy changes. Generated replies vary. The behavior you need to verify stays the same.
**semantic-assert** checks plain-English claims about JSON or a captured page,
with a model as the judge and pass/fail thresholds in your code.

```ts
await judge.expectPageTo("The alert explains how to recover from the error", {
  region: page.getByRole("alert"),
});
```

This uses the [Playwright fixture](./reference/playwright#fixture). For API responses
and other JSON, use the framework-independent [core judge](./reference/core).

## Start with a familiar testing problem

<div class="example-links">
  <a href="./examples/html-alerts.html">
    <strong>Your PM changed the copy. Why is CI red? →</strong>
    <span>Check that an alert explains the failure and recovery step across copy edits.</span>
  </a>
  <a href="./examples/generated-replies.html">
    <strong>Your test passes. Your bot just promised a refund. →</strong>
    <span>Catch a forbidden promise even when the reply never uses the word “refund”.</span>
  </a>
</div>

## How it works

1. **Capture state.** Return JSON from your application, or capture a page with Playwright.
2. **Write claims.** Describe the observable behavior. Related claims share one provider request.
3. **Assert a result.** The judge compares the returned probabilities with your thresholds.

For changing state, the judge can capture and evaluate again until the claims pass
or polling times out. For a fixed response, evaluate once with `timeoutMs: 0`.
Usage metrics record calls, tokens, and provider wait time.

## Where semantic assertions fit

| Use semantic assertions for                        | Keep ordinary assertions for     |
| -------------------------------------------------- | -------------------------------- |
| Whether an error gives a concrete recovery step    | Whether the alert is visible     |
| Whether a reply promises a refund                  | Exact order IDs and status codes |
| Whether a response answers the customer's question | Counts, totals, and arithmetic   |
| Whether a highlighted passage supports a claim     | Exact CSS values and class names |

Model judgments are probabilistic. Calibrate thresholds with both acceptable and
unacceptable examples from your application. A passing assertion is the model's
assessment, not proof of correctness.

## Get started

Follow the [quick start](./getting-started) for a runnable check, then add the
[Playwright adapter](./reference/playwright) for HTML and browser tests.

Node.js 22 or newer is supported. Packages ship ESM, CommonJS, and TypeScript declarations.
