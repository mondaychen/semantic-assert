---
title: Playwright
description: Set up the Playwright judge fixture, scope page captures, redact sensitive data, and attach assertion evidence.
---

# Playwright

The adapter captures what a screen reader would see: the accessibility snapshot,
the URL, and the title. Your claims are judged against that text, not the raw HTML
or a screenshot, which keeps judgments anchored to what a user can actually tell.

::: info You will learn

- How to add the `judge` fixture to your tests
- Why the judge evaluates once, and when to wait or poll
- How to scope a capture to one region
- How to use the `expect` matchers
- How to redact data before it leaves the browser
- How to test visual styling and read the evidence report

:::

## Install

```sh
pnpm add -D @playwright/test semantic-assert semantic-assert-playwright semantic-assert-typesafe
pnpm exec playwright install chromium
export TYPESAFE_API_KEY="your-api-key"
```

The adapter needs `@playwright/test >=1.50.0` and Node.js 22 or newer.

## Fixture

Extend Playwright's `test` with the judge fixtures in a `fixtures.ts`:

```ts
import { test as base } from "@playwright/test";
import {
  judgeFixtures,
  type JudgeFixtures,
  type JudgeFixtureOptions,
} from "semantic-assert-playwright";
import { typesafe } from "semantic-assert-typesafe";

export const test = base.extend<JudgeFixtures & JudgeFixtureOptions>({
  ...judgeFixtures,
  judgeProvider: [typesafe({ timeoutMs: 10_000, maxRetries: 0 }), { option: true }],
});

test.use({ judgeOptions: { threshold: 0.8 } });
export { expect } from "@playwright/test";
```

::: warning Pitfall
The provider object belongs where `test` is built, as above. Don't put it in the
Playwright config's `use` block. That block is serialized to workers, and a
provider instance doesn't survive the trip. `judgeOptions` is plain data and can
live anywhere.
:::

Then use `judge` like any other fixture, here in `alert.spec.ts`:

```ts
import { test, expect } from "./fixtures";

test("an alert explains how to recover", async ({ page, judge }) => {
  await page.setContent(`
    <p role="alert">Your changes haven't been saved. Please give it another try.</p>
  `);

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await judge.expectPageTo("The alert asks the user to try again", {
    region: alert,
  });
});
```

Run it with `pnpm exec playwright test`. In a real test, replace `page.setContent`
with navigation and interactions.

## Wait first, then judge once

Semantic assertions evaluate once by default (`timeoutMs: 0`). Let Playwright do
the waiting, then ask the model about meaning:

```ts
const alert = page.getByRole("alert");
await alert.waitFor({ state: "visible" });
await judge.expectPageTo("The alert explains how to recover", { region: alert });
```

`await expect(alert).toBeVisible()` waits and asserts visibility in one line. If
the element appears before its final content does, wait for your application's
ready state as well.

### Regions wait on their own

A `region` capture waits for its element to attach, up to `regionTimeoutMs`.
The default is 5 s, the same as Playwright's `expect` timeout. That wait happens
in the browser and sends nothing to the model, so it's separate from `timeoutMs`.
Set it per call or for the whole suite in `judgeOptions`. A region that never
appears fails with `RegionNotFoundError`.

### Opt into polling

For content you want the judge to keep checking, set a positive `timeoutMs`:

```ts
await judge.expectPageTo("The export is ready to download", {
  region: page.getByRole("status"),
  timeoutMs: 5_000,
  pollIntervalMs: 1_000,
});
```

The judge recaptures the region between evaluations and stops as soon as the
claim passes. Provider request timeouts and retries are configured separately.

## Scope the capture

Pass a `region` locator or CSS selector to capture only the relevant content:

```ts
await judge.expectPageTo("The message confirms that the purchase succeeded", {
  region: page.getByRole("region", { name: "Order confirmation" }),
});
```

Scoping does two jobs. It shrinks the text sent to the model, and it stops
unrelated page content from filling in information the region itself is missing.

Use `expectPage` to batch several claims into one request, and `expectPageNotTo`
for a single negative claim. Both accept per-call thresholds, polling options,
and `regionTimeoutMs`.

## Matcher syntax

If you'd rather assert on locators directly, create a judge-aware `expect`:

```ts
import { createJudgeExpect } from "semantic-assert-playwright";
import { typesafe } from "semantic-assert-typesafe";

const expect = createJudgeExpect({ provider: typesafe() });

await expect(page.getByRole("alert")).toSatisfy("The alert explains how to recover");

await expect(page.getByTestId("agent-panel")).toSatisfyAll([
  "The panel contains a reply to the customer's question",
  { claim: "The reply promises a refund", expected: false },
]);
```

Like Playwright's built-in locator matchers, these wait for the locator to attach,
up to `regionTimeoutMs`, and then evaluate once.

::: warning Pitfall
These matchers reject `.not`. A claim that misses its threshold isn't evidence of
the opposite. Use `{ claim, expected: false }` to require evidence for a negative
claim instead.
:::

## Redact sensitive data

Everything you capture is sent to the configured provider. Use the `redact` hook
to change the state right before that request:

```ts
await judge.expectPageTo("The error gives the user a recovery step", {
  region: page.getByRole("alert"),
  redact: (state) => ({
    ...state,
    aria_snapshot: state.aria_snapshot.replaceAll("alex@example.test", "[email redacted]"),
  }),
});
```

This example removes one known email from the snapshot. When your captures carry
sensitive information, review the URL, title, links, visual hints, and extra state
too.

## Visual hints

An accessibility snapshot says nothing about styling. Turn on `visualHints` for
claims about highlights, bold text, strikethrough, or text color:

```ts
await judge.expectPageTo("A passage has a highlighted background", {
  region: page.locator(".document"),
  visualHints: { dataAttributes: ["data-highlight-kind"] },
});
```

Hints are text observations gathered from the page, not screenshot analysis, and
they're off by default because they cost an extra evaluation and tokens. For
exact style checks, stay with `toHaveCSS` or `toHaveClass`.

## Evidence and reporting

The fixture attaches judgment evidence to Playwright's report, including the
captured state when a claim fails. Add the usage reporter to
`playwright.config.ts` to collect spend across the run:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    [
      "semantic-assert-playwright/reporter",
      { outputFile: "test-results/semantic-assert-metrics.json" },
    ],
  ],
});
```

The report lists calls, tokens, provider wait time, and estimated cost once you
configure provider rates. See [providers](./providers) for those settings.

## Recap

- Add `judgeFixtures` to your `test`, and give the provider where `test` is built.
- Let Playwright wait, then judge once. Regions wait up to `regionTimeoutMs` on their own.
- Scope captures with `region`. It saves tokens and keeps the model honest.
- Matchers auto-wait like the built-ins and reject `.not`.
- Redact before the request, turn on `visualHints` only for styling claims, and add the reporter to see what a run cost.
