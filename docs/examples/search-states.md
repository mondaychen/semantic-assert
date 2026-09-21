---
title: Loading vs. empty states
description: Distinguish a useful empty search state from loading or failure instead of treating zero rows as success.
---

# Loading vs. empty states

<p class="page-hook">Zero results... or did it just not load yet?</p>

A new account has no projects. Your test checks for zero rows and passes while the
search is still loading. The same assertion passes after an error, too.

## Before: infer meaning from an empty container

```ts
const results = page.getByRole("main", { name: "Search results" });
await expect(results.getByRole("listitem")).toHaveCount(0);
```

Zero rows is an exact fact. It just doesn't tell you the search finished, or that
the user knows what to do next.

## After: name the states and ask which one this is

Use `classifyPage` from the [Playwright judge fixture](../reference/playwright#fixture)
to classify the captured region. This scenario expects the empty state:

```ts
const result = await judge.classifyPage(
  "What is the search results state?",
  {
    loading: "The search is in progress.",
    results: "The page lists matching projects.",
    empty: "No projects match and the page suggests what to do next.",
    error: "The search failed with an error.",
  },
  {
    region: page.getByRole("main", { name: "Search results" }),
    settled: ["results", "empty"],
    timeoutMs: 10_000,
  },
);

expect(result.choice).toBe("empty");
expect(result.confidence).toBeGreaterThanOrEqual(0.8);
```

With a positive `timeoutMs`, the judge recaptures the page while the answer is
outside `settled`, so `loading` keeps it polling. Once it lands on a settled
state, your assertions decide whether that state is the right one for this test.

::: warning Pitfall
`classifyPage` returns its last answer on timeout, even when that answer is
`loading` or `error`. Calling the classifier alone can never fail the test. Keep
the explicit choice and confidence checks.
:::

## Same row count, different outcomes

| Page content                                                          | Intended outcome for this test                  |
| --------------------------------------------------------------------- | ----------------------------------------------- |
| “Searching projects…”                                                 | Keep polling; fail if it never settles.         |
| “No projects found. Try another search or create your first project.” | Accept as a useful empty state.                 |
| “Nothing matches yet. Change your search terms to try again.”         | Accept despite the copy change.                 |
| “We couldn't search your projects. Please retry.”                     | Reject if the error persists.                   |
| A list of matching projects                                           | Reject: this scenario expects an empty account. |

Choice confidence depends on the provider. Check your threshold against known
states, including a blank region and a partial render. Ambiguous content can be
misclassified.

## Run the existing search test

After [setting up the repository examples](https://github.com/mondaychen/semantic-assert/blob/main/examples/README.md):

```sh
pnpm --filter semantic-assert-examples test:playwright classification.spec.ts
```

The [runnable test](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/classification.spec.ts)
moves local HTML from loading to a guided empty state, and its default fake
provider scripts those answers. For live judgments, with `AI_GATEWAY_API_KEY` in
`.env`:

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts classification.spec.ts
```

::: tip When not to classify
Polling can make several provider requests. If your app exposes a reliable status
field or an exact empty-state marker, an ordinary assertion on that is cheaper
and just as good. Reach for classification when you need to interpret the
rendered message across changing wording.
:::
