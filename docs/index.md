---
title: Introduction
description: Assert the meaning of generated responses and HTML pages, with plain-English claims and a model as the judge.
---

# Test what your app means.

Copy changes. Generated replies vary. The behavior you need to verify stays the same.
**semantic-assert** lets you write plain-English claims about JSON or a captured
page, hands them to a model that acts as the judge, and keeps the pass/fail
thresholds in your code.

```ts
const alert = page.getByRole("alert");
await alert.waitFor({ state: "visible" });
await judge.expectPageTo("The alert explains how to recover from the error", {
  region: alert,
});
```

That's the [Playwright fixture](./reference/playwright#fixture). For API responses
and other JSON, use the framework-independent [core judge](./reference/core).

## Start with a problem you've probably hit

<div class="example-links">
  <a href="./examples/html-alerts.html">
    <strong>Your PM changed the copy. Why is CI red? →</strong>
    <span>Check that an alert explains the failure and recovery step across copy edits.</span>
  </a>
  <a href="./examples/generated-replies.html">
    <strong>Your test passes. Your bot just promised a refund. →</strong>
    <span>Catch a forbidden promise even when the reply never uses the word “refund”.</span>
  </a>
  <a href="./examples/page-coherence.html">
    <strong>The route changed. The tab title didn't. →</strong>
    <span>Check that the title, navigation, and main content agree after a client-side navigation.</span>
  </a>
</div>

More before-and-after examples:

- [Checkout confirmations](./examples/checkout): “Thanks” appears, but the customer still doesn't know whether the order succeeded.
- [Loading vs. empty states](./examples/search-states): zero rows can mean no results, a pending request, or an error.
- [Highlighted passages](./examples/highlights): a highlight exists, but it's on the wrong passage.
- [Answers grounded in a policy](./examples/grounded-answers): the answer has the right keywords and gives the wrong advice.

## How it works

Every semantic assertion follows the same three steps:

1. **Capture state.** Return JSON from your app, or let the Playwright adapter snapshot a page.
2. **Write claims.** Describe what a user should be able to tell from that state. Related claims travel in one request.
3. **Assert the result.** The judge compares the probabilities that come back with your thresholds, and fails the test when a claim doesn't clear its bar.

### Who's the judge?

By default, [Jev](https://typesafe.ai), TypeSafe's first
[System One model](https://docs.typesafe.ai/concepts/system-one). Jev doesn't
generate text. You give it state and a yes/no or multiple-choice question, and it
returns a typed answer with a calibrated probability. That's what lets a threshold
in your code act as a real pass mark. Any `Provider` implementation can stand in
for it; see [providers](./reference/providers).

### One evaluation by default

Assertions evaluate once (`timeoutMs: 0`). A Playwright `region` waits up to 5 s
for its element to attach before that single evaluation, so locator assertions
still auto-wait. If content settles later than that, wait for it with Playwright
first. For state that's genuinely changing, opt into repeated checks with a
positive `timeoutMs`. Usage metrics record every call, its tokens, and the time
spent waiting on the provider.

## Where semantic assertions fit

| Use semantic assertions for                        | Keep ordinary assertions for     |
| -------------------------------------------------- | -------------------------------- |
| Whether an error gives a concrete recovery step    | Whether the alert is visible     |
| Whether a reply promises a refund                  | Exact order IDs and status codes |
| Whether a response answers the customer's question | Counts, totals, and arithmetic   |
| Whether a highlighted passage supports a claim     | Exact CSS values and class names |

::: warning Model judgments are probabilistic
Calibrate thresholds with both good and bad examples from your own app. A passing
assertion is the model's assessment, not proof of correctness.
:::

## Get started

Follow the [quick start](./getting-started) for a runnable check, then add the
[Playwright adapter](./reference/playwright) for HTML and browser tests.
