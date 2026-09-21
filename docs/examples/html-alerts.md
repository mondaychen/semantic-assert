---
title: HTML alerts & copy changes
description: Replace brittle exact-text checks with semantic assertions that accept copy edits and catch missing recovery guidance.
---

# Your PM changed the copy. Why is CI red?

Your alert still explains the same problem and the same recovery step. Only the
wording changed.

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

The rewrite breaks this assertion even though the alert tells the user exactly the
same thing. You can update the expected string, and the next edit breaks it again.

## After: assert what the user needs to know

With the [Playwright judge fixture](../reference/playwright#fixture), describe the
two things the alert has to communicate:

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

Visibility stays in an ordinary Playwright assertion. The judge evaluates both
claims in one request. Scoping the capture to `alert` matters: without it,
recovery advice elsewhere on the page could fill in what the alert itself is
missing.

## Keep a real regression in the test set

Accepting alternative wording is half the job. The test should also reject a
message that has lost the information the user needs.

| Alert text                                                     | Intended outcome | Why                                                          |
| -------------------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| “We couldn't save your changes. Try again.”                    | Accept           | Explains the failure and the recovery step.                  |
| “Your changes haven't been saved. Please give it another try.” | Accept           | Preserves both requirements after the copy edit.             |
| “Something went wrong.”                                        | Reject           | Doesn't say what happened to the changes or what to do next. |

The [runnable test](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/alert-copy.spec.ts)
renders each message as local HTML, and deliberately puts recovery advice outside
the alert to show why the capture is scoped. Each page is judged once.

::: warning Pitfall
These are intended outcomes, not guaranteed model behavior. When you calibrate
your provider and threshold, try both acceptable copy edits and real regressions.
A threshold that only ever sees good examples tells you nothing.
:::

## Run the HTML example

From a checkout of the repository:

```sh
pnpm install
pnpm build
pnpm exec playwright install chromium
pnpm --filter semantic-assert-examples test:playwright alert-copy.spec.ts
```

The default provider returns scripted scores. That verifies the browser capture
and assertion flow without an API key, but it doesn't verify that the model
understands the text. For real judgments, put `AI_GATEWAY_API_KEY` in `.env` and
run:

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts alert-copy.spec.ts
```

The three cases make three evaluations, each with two claims and no polling. The
incomplete-message case passes by catching the expected semantic assertion
failure.

## Use your application's page

Replace `page.setContent(...)` with `page.goto(...)` and the actions that trigger
your alert. Keep the role-based locator, the visibility check, and the claims.

The `region` capture waits up to `regionTimeoutMs` (5 s by default) for the alert
to attach, so a late render won't fail the test on its own. Waiting yourself with
`await expect(alert).toBeVisible()` still gives a clearer failure when the alert
never shows. If the alert's content keeps changing after it appears, wait for
your application's ready state, or opt into polling with a positive `timeoutMs`.
