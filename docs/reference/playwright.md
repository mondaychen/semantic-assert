---
title: Playwright
description: Set up the Playwright judge fixture, scope page captures, redact sensitive data, and attach assertion evidence.
---

# Playwright

The adapter captures an accessibility snapshot, URL, and title. Claims are judged
against that captured text, rather than the raw HTML source or a screenshot.

## Install

```sh
pnpm add -D @playwright/test semantic-assert semantic-assert-playwright semantic-assert-typesafe
pnpm exec playwright install chromium
export TYPESAFE_API_KEY="your-api-key"
```

The adapter requires `@playwright/test >=1.50.0` and Node.js 22 or newer.

## Fixture

Create `fixtures.ts`:

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

The provider object belongs in the fixture definition. Do not place it in the
Playwright config's `use` block, which is serialized to workers.

Use it in `alert.spec.ts`:

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

Run with `pnpm exec playwright test`. Replace `page.setContent` with navigation and
interactions for an application test.

## Wait first, then judge once

Semantic assertions evaluate once by default (`timeoutMs: 0`). Let Playwright
wait for the target before asking the model about its meaning:

```ts
const alert = page.getByRole("alert");
await alert.waitFor({ state: "visible" });
await judge.expectPageTo("The alert explains how to recover", { region: alert });
```

`await expect(alert).toBeVisible()` also waits and asserts visibility. If the
element appears before its final content arrives, wait for your application's
ready state as well.

For content you want the judge to keep checking, opt into polling:

```ts
await judge.expectPageTo("The export is ready to download", {
  region: page.getByRole("status"),
  timeoutMs: 5_000,
  pollIntervalMs: 1_000,
});
```

This recaptures the target between evaluations and stops as soon as the claim
passes. Provider request timeouts and retries are configured separately.

## Scope the capture

Pass a `region` locator or CSS selector to capture just the relevant content.
This also reduces the text sent to the model.

```ts
await judge.expectPageTo("The message confirms that the purchase succeeded", {
  region: page.getByRole("region", { name: "Order confirmation" }),
});
```

Use `expectPage` to batch multiple claims. Use `expectPageNotTo` for one negative
claim. Both support per-call thresholds and polling options.

## Matcher syntax

If you prefer assertions on locators, create a judge-aware `expect`:

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

These semantic matchers reject `.not`. Use `expected: false` to require evidence
for a negative claim.

## Redact sensitive data

Captured state is sent to the configured provider. The `redact` hook runs before
that request:

```ts
await judge.expectPageTo("The error gives the user a recovery step", {
  region: page.getByRole("alert"),
  redact: (state) => ({
    ...state,
    aria_snapshot: state.aria_snapshot.replaceAll("alex@example.test", "[email redacted]"),
  }),
});
```

This example removes one known email. Review URL, title, links, visual hints, and
extra state as well when your captures contain sensitive information.

## Visual hints

An accessibility snapshot does not describe styling. Enable `visualHints` for
claims about highlights, bold text, strikethrough, or text color:

```ts
await judge.expectPageTo("A passage has a highlighted background", {
  region: page.locator(".document"),
  visualHints: { dataAttributes: ["data-highlight-kind"] },
});
```

Hints are text observations gathered from the page, not screenshot analysis.
They are off by default. Use `toHaveCSS` or `toHaveClass` for exact style checks.

## Evidence and reporting

The fixture attaches judgment evidence to Playwright reports, including captured
state when claims fail. Add the usage reporter to `playwright.config.ts`:

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

The report includes calls, tokens, provider wait, and estimated cost when you
configure provider rates. See [providers](./providers) for those settings.
