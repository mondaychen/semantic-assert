---
title: HTML alerts & copy changes
description: Replace brittle exact-text checks with semantic assertions that accept copy edits and catch missing recovery guidance.
---

# Your PM changed the copy. Why is CI red?

Your alert still explains the same problem and recovery step. Only the wording changed.

```html
<!-- Before the copy edit -->
<p role="alert">We couldn't save your changes. Try again.</p>

<!-- After the copy edit -->
<p role="alert">Your changes haven't been saved. Please give it another try.</p>
```

## Before: couple the test to the wording

```ts
await expect(page.getByRole("alert")).toHaveText("We couldn't save your changes. Try again.");
```

The PM's rewrite breaks this assertion even though it tells the user the same thing.
Updating the expected string fixes today's failure, but the next edit breaks it again.

## After: assert what the user needs to know

With the [Playwright judge fixture](../reference/playwright#fixture):

```ts
const alert = page.getByRole("alert");
await expect(alert).toBeVisible();
await judge.expectPage(
  [
    { claim: "The alert tells the user their changes were not saved" },
    { claim: "The alert asks the user to try again" },
  ],
  { region: alert },
);
```

Visibility stays in an ordinary Playwright assertion. The judge evaluates two
claims about the alert's meaning in one request. Scoping the capture to `alert`
keeps unrelated page text from filling in missing information.

## Keep a real regression in the test set

Accepting alternative wording is only half the job. The test should also reject
a message that has lost the information the user needs.

| Alert text                                                     | Intended outcome | Why                                                           |
| -------------------------------------------------------------- | ---------------- | ------------------------------------------------------------- |
| “We couldn't save your changes. Try again.”                    | Accept           | Explains the failure and the recovery step.                   |
| “Your changes haven't been saved. Please give it another try.” | Accept           | Preserves both requirements after the copy edit.              |
| “Something went wrong.”                                        | Reject           | Does not say what happened to the changes or what to do next. |

The [runnable test](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/alert-copy.spec.ts)
renders each message as local HTML. It also places recovery advice outside the
alert to demonstrate why the capture should be scoped. Each fixed page is judged
once, using the default zero polling timeout.

::: tip Check both sides
These are intended outcomes, not guaranteed model behavior. Try acceptable copy
edits and actual regressions when calibrating your provider and threshold.
:::

## Run the HTML example

From a checkout of the repository:

```sh
pnpm install
pnpm build
pnpm exec playwright install chromium
pnpm --filter semantic-assert-examples test:playwright alert-copy.spec.ts
```

The default provider uses scripted scores. This verifies the browser capture and
assertion flow without an API key; it does not verify the model's understanding.

For real judgments, put `AI_GATEWAY_API_KEY` in `.env` and run:

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts alert-copy.spec.ts
```

The three cases use three evaluations, each with two claims and no polling.
The incomplete-message case passes the test by catching the expected semantic
assertion failure.

## Use your application's page

Replace the example's `page.setContent(...)` with `page.goto(...)` and the actions
that trigger your alert. Keep the role-based locator, visibility check, and claims.
The `region` capture waits up to `regionTimeoutMs` (5 s by default) for the alert
to attach, so a late render does not fail the test. Waiting for it yourself with
`await expect(alert).toBeVisible()` still gives a clearer failure when the alert
never shows. If its content is still changing, wait for the application's ready
state or explicitly opt into semantic polling with a positive `timeoutMs`.
