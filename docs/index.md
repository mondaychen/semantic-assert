---
title: Introduction
description: Assert the meaning of generated responses and HTML pages, with plain-English claims and a model as the judge.
---

# Test what your app means.

<ExpandableImage
  src="/comic-exact-match.webp"
  alt="A four-panel comic titled Exact Match. A developer writes a test that checks an alert's exact text, thinking it will break the second anyone touches the copy. Two weeks later a PM makes the error message friendlier and the test fails. The developer pastes in the new string. A week later the PM changes the copy back and asks whether the test broke again. The developer says no, they found a better way to do testing, and the screen shows a passing assertion that reads: the alert tells the user how to recover."
/>

**semantic-assert** lets you assert the requirement instead. Write the claim the
way the PRD states it, hand it to a model that acts as the judge, and keep the
pass/fail threshold in your code. Thanks to latest AI, it's fast, cheap, and
reliable.

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
    <strong>Your PM changed the copy... and yeah the CI turned red. →</strong>
    <span>Check that an alert explains the failure and recovery step across copy edits.</span>
  </a>
  <a href="./examples/generated-replies.html">
    <strong>The bot just promised a refund? How did the CI pass? →</strong>
    <span>Catch a forbidden promise even when the reply never uses the word “refund”.</span>
  </a>
  <a href="./examples/page-coherence.html">
    <strong>The route changed. The tab title didn't. →</strong>
    <span>Check that the title, breadcrumb, and heading agree, even when the page is named by whatever the user typed.</span>
  </a>
</div>

Or one of these:

- [Zero results. Or just not loaded yet?](./examples/search-states) Zero rows can mean no results, a request still in flight, or an error.
- [A passage is highlighted... in the wrong place.](./examples/highlights) The styling is there. It's attached to the wrong text.
- [The answer says “30 days”. The advice is still wrong.](./examples/grounded-answers) The right keywords, the wrong conclusion.

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
