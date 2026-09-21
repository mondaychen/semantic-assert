---
title: Page coherence after navigation
description: Check that the document title, navigation, and main content of a page all describe the same section, without pinning every string.
---

# The route changed. The tab title didn't.

Your single-page app swaps the main content and highlights the new nav item. The
document title still names the previous page. Every exact assertion you wrote is
green, because each one checks a piece of the page on its own.

```html
<!-- After clicking "Pricing" in a router that forgets the title -->
<title>Home | Acme</title>
<nav aria-label="Main">
  <a href="/">Home</a>
  <a href="/pricing" aria-current="page">Pricing</a>
  <a href="/docs">Docs</a>
</nav>
<main>
  <nav aria-label="Breadcrumb">Home › Pricing</nav>
  <h1>Plans and pricing</h1>
  <p>Start free. Upgrade when your team grows.</p>
</main>
```

## Before: pin every string, or check nothing across them

```ts
await expect(page).toHaveTitle("Pricing | Acme");
await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plans and pricing");
await expect(page.getByRole("link", { name: "Pricing" })).toHaveAttribute("aria-current", "page");
```

This works until marketing renames the heading to “Simple, honest pricing” or the
title format changes to “Acme Pricing”. Every route needs its own copy of the
three strings, and none of the assertions say the thing that actually matters:
the three places agree with each other.

## After: assert the agreement, not the words

With the [Playwright judge fixture](../reference/playwright#fixture), read the
current nav item with Playwright and hand it to the judge along with the main
region:

```ts
const main = page.getByRole("main");
const currentNavItem = await page
  .getByRole("navigation", { name: "Main" })
  .locator("[aria-current='page']")
  .textContent();

await judge.expectPage(
  [
    { claim: "The document title describes the same section as the main heading" },
    { claim: "The current navigation item names the section shown in the main content" },
  ],
  { region: main, extraState: { current_nav_item: currentNavItem ?? "" } },
);
```

Each claim names one relationship, so a failure tells you which signal went stale.
The capture is scoped to `main`, which keeps the request small. The document title
is already part of every captured page state, and `extraState` adds the current
nav item under a name the claims can use.

::: details Deep dive: why pass the nav item explicitly?
The aria snapshot lists the navigation links and their URLs, but it doesn't record
`aria-current`. Reading the current item with Playwright and handing it to the
judge is more reliable than asking the model to work it out from the URL.
:::

## Keep a real regression in the test set

| Page state after clicking “Pricing”                 | Intended outcome | Why                                                 |
| --------------------------------------------------- | ---------------- | --------------------------------------------------- |
| Title, breadcrumb, heading, and nav all say Pricing | Accept           | Every signal describes the same section.            |
| Heading reworded to “Simple, honest pricing”        | Accept           | Different words, same section.                      |
| Title still says “Home”                             | Reject           | The title claim fails; the nav claim keeps passing. |

The [runnable test](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/page-coherence.spec.ts)
renders a three-route app as local HTML with a click-driven router. One test uses
a router that updates everything. A second uses a router that forgets the title,
and checks that only the title claim fails, so the failure points at the bug.

## Run the example

From a checkout of the repository:

```sh
pnpm install
pnpm build
pnpm exec playwright install chromium
pnpm --filter semantic-assert-examples test:playwright page-coherence.spec.ts
```

The default provider returns scripted scores. For real judgments, put
`AI_GATEWAY_API_KEY` in `.env` and run:

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts page-coherence.spec.ts
```

Both tests evaluate once, with two claims in one request each.

## Use your application's page

Replace `page.setContent(...)` with `page.goto(...)` and a real navigation. The
captured state then includes the real URL, one more signal for the model to
compare. Keep exact checks, such as the URL path or an order ID, in ordinary
Playwright assertions. If your layout keeps a breadcrumb or the page `<h1>`
outside `main`, add a claim for it and widen the region to match.
