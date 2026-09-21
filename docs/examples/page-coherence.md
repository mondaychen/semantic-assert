---
title: Page coherence after navigation
description: Check that the document title, breadcrumb, and heading of a page all describe the same thing, even when that thing is named by user input.
---

# Page coherence after navigation

<p class="page-hook">The route changed but the tab title didn't... and every test stayed green.</p>

A user creates a project and names it whatever they like. Your app navigates to
the new project's page and derives the title, the breadcrumb, and the heading from
that name. Except the router forgot the title, so the tab still says “New
project”.

```html
<!-- After creating "q3 launch plan" in a router that forgets the title -->
<title>New project · Acme Projects</title>
<nav aria-label="Main">
  <a href="/">Home</a>
  <a href="/projects" aria-current="page">Projects</a>
  <a href="/docs">Docs</a>
</nav>
<main>
  <nav aria-label="Breadcrumb">Projects › Q3 Launch Plan</nav>
  <h1>Q3 Launch Plan</h1>
  <p>No tasks yet. Add the first task to get started.</p>
</main>
```

## Before: predict the title, or check nothing across the page

You know what the user typed. You don't know how the app renders it. The title
gets a suffix, the name gets trimmed and title-cased, and the breadcrumb has its
own format. To assert exact strings, the test has to reimplement all of that:

```ts
const name = "  q3 launch plan  ";
const rendered = name.trim().replace(/\b\w/g, (c) => c.toUpperCase());

await expect(page).toHaveTitle(`${rendered} · Acme Projects`);
await expect(page.getByRole("heading", { level: 1 })).toHaveText(rendered);
await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveText(
  `Projects › ${rendered}`,
);
```

Now the test mirrors the app's formatting code, and breaks whenever a designer
changes the title pattern or the breadcrumb separator. And none of the three
assertions say the thing that actually matters: the three places agree with each
other.

## After: assert the agreement, and anchor it to the input

With the [Playwright judge fixture](../reference/playwright#fixture), hand the
judge the main region plus the raw input the user typed:

```ts
const name = "  q3 launch plan  ";
await page.getByLabel("Project name").fill(name);
await page.getByRole("button", { name: "Create project" }).click();

await judge.expectPage(
  [
    {
      claim:
        "The document title, the breadcrumb, and the main heading all refer to the same project",
    },
    { claim: "The page is about the project the user named in `project_name_entered`" },
  ],
  { region: page.getByRole("main"), extraState: { project_name_entered: name } },
);
```

The first claim has no expected value at all. It asks whether the page agrees
with itself, which is exactly the thing you can't check with a string. The second
anchors the page to what the user typed, and leaves the app's trimming, casing,
and suffixes to the model. If a designer changes the title pattern tomorrow, both
claims still hold.

Each claim names one relationship, so a failure tells you which signal went
stale. The capture is scoped to `main`, which keeps the request small. The
document title is already part of every captured page state, and `extraState`
adds the raw input under a name the claims can use.

::: details Deep dive: when the name isn't even yours
The test above knows the input because it typed it. The same claims work when it
doesn't. Seed the project from a fixture, read the name back from the database or
the API response, and pass that through `extraState`. Or drop the second claim
entirely and keep only the coherence check, which needs no expected value from
anywhere.
:::

## Keep a real regression in the test set

| Page state after creating “q3 launch plan”              | Intended outcome | Why                                                      |
| ------------------------------------------------------- | ---------------- | -------------------------------------------------------- |
| Title, breadcrumb, and heading all say “Q3 Launch Plan” | Accept           | Every signal names the project the user created.         |
| Title pattern changed to “Acme · Q3 Launch Plan”        | Accept           | Different format, same project.                          |
| Title still says “New project”                          | Reject           | The coherence claim fails; the input claim still passes. |
| Heading shows a different project's name                | Reject           | Both claims fail: the page isn't about what was typed.   |

The [runnable test](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/page-coherence.spec.ts)
renders the app as local HTML with a form and a click-driven router. One test uses
a router that updates everything. A second uses a router that forgets the title,
and checks that only the coherence claim fails, so the failure points at the bug.

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

Replace `page.setContent(...)` with `page.goto(...)` and your real form. The
captured state then includes the real URL, one more signal for the model to
compare. Keep exact checks, such as the URL containing the new project's ID, in
ordinary Playwright assertions. If your layout keeps a breadcrumb or the page
`<h1>` outside `main`, widen the region to match.
