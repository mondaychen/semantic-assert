---
title: Highlighted passages
description: Check that the relevant passage is highlighted and obsolete guidance is struck through, rather than only finding a styled element.
---

# A passage is highlighted. It's the wrong one.

Your document viewer highlights a cited policy passage and strikes through
obsolete guidance. A style check can pass even when the decoration is attached
to unrelated text.

## Before: check that decoration exists

```ts
const policy = page.getByRole("article", { name: "Return policy" });

await expect(policy.locator("mark")).toHaveCount(1);
await expect(policy.locator("s")).toHaveCount(1);
```

Both assertions pass if the heading is highlighted and the current return policy
is struck through by mistake. They verify the markup without establishing which
information the styling applies to.

## After: connect the styling to the content

With the [Playwright judge fixture](../reference/playwright#fixture):

```ts
const policy = page.getByRole("article", { name: "Return policy" });
await policy.waitFor({ state: "visible" });

await judge.expectPage(
  [
    { claim: "The passage about the return window has a highlighted background" },
    { claim: "The instruction to request returns by phone is struck through" },
    { claim: "The return window passage is struck through", expected: false },
  ],
  {
    region: policy,
    visualHints: { dataAttributes: ["data-highlight-kind"] },
  },
);
```

For example, these claims describe this document:

```html
<article aria-label="Return policy">
  <h1>Return policy</h1>
  <p>
    <mark data-highlight-kind="citation">Unopened items can be returned within 30 days.</mark>
  </p>
  <p><s>Returns must be requested by phone.</s> Start your return from your account.</p>
</article>
```

`visualHints` adds text observations about backgrounds, emphasis, strikethrough,
and the requested data attributes. This lets the model associate the styling with
the passage's meaning. Without it, the accessibility snapshot alone does not
describe those visual properties.

## Preserve the meaning across restyling

| Change                                                                                  | Intended outcome                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Change the return-window highlight from yellow to blue.                                 | Accept: the claim does not require a particular color. |
| Reword the obsolete instruction as “Call us to arrange a return,” still struck through. | Accept: the same obsolete guidance is marked.          |
| Highlight the heading instead of the return-window passage.                             | Reject: the required passage is not highlighted.       |
| Strike through the current return window.                                               | Reject: the negative claim catches the contradiction.  |

These checks use text observations, not screenshot analysis. They do not establish
pixel-perfect layout, sufficient color contrast, or exact CSS values. Keep
ordinary style assertions when those exact properties are the requirement.

## Run the existing document test

After [setting up the repository examples](https://github.com/mondaychen/semantic-assert/blob/main/examples/README.md):

```sh
pnpm --filter semantic-assert-examples test:playwright visual-matchers.spec.ts
```

The [runnable test](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/visual-matchers.spec.ts)
checks this document using the equivalent `toSatisfyAll` matcher. Its default
provider returns scripted scores. For live judgments, with `AI_GATEWAY_API_KEY`
in `.env`:

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts visual-matchers.spec.ts
```

The table suggests additional calibration cases; the runnable test covers the
correctly styled document.
