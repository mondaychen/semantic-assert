---
title: Loading vs. empty states
description: Distinguish a useful empty search state from loading or failure instead of treating zero rows as success.
---

# Zero results. Or just not loaded yet?

A new account has no projects. Your test checks for zero rows and passes while
the search is still loading. The same assertion could pass after an error.

## Before: infer meaning from an empty container

```ts
const results = page.getByRole("main", { name: "Search results" });
await expect(results.getByRole("listitem")).toHaveCount(0);
```

Zero rows is an exact fact, but it does not establish that the search finished
successfully or that the user knows what to do next.

## After: distinguish the page states

Use the [Playwright judge fixture](../reference/playwright#fixture) to classify
the captured region. The scenario below expects an empty state for a new account:

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

The judge recaptures the page while the answer is outside `settled`. When it
chooses a settled state, your assertions decide whether that state is correct
for this scenario.

::: tip Classification needs an assertion
`classifyPage` returns its last answer on timeout, even when that answer is
`loading` or `error`. Keep the explicit choice and confidence checks. Calling
the classifier alone does not make the test fail.
:::

## Same row count, different outcomes

| Page content                                                          | Intended outcome for this test                  |
| --------------------------------------------------------------------- | ----------------------------------------------- |
| “Searching projects…”                                                 | Keep polling; fail if it never settles.         |
| “No projects found. Try another search or create your first project.” | Accept as a useful empty state.                 |
| “Nothing matches yet. Change your search terms to try again.”         | Accept despite the copy change.                 |
| “We couldn't search your projects. Please retry.”                     | Reject if the error persists.                   |
| A list of matching projects                                           | Reject: this scenario expects an empty account. |

Choice confidence depends on the provider. Check your threshold with known states,
including a blank region or a partial render. A model can misclassify ambiguous
content.

## Run the existing search test

After [setting up the repository examples](https://github.com/mondaychen/semantic-assert/blob/main/examples/README.md):

```sh
pnpm --filter semantic-assert-examples test:playwright classification.spec.ts
```

The [runnable test](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/classification.spec.ts)
changes local HTML from loading to a guided empty state. Its default fake provider
scripts those answers. For live judgments, with `AI_GATEWAY_API_KEY` in `.env`:

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts classification.spec.ts
```

Polling can make multiple provider requests. If the application exposes a reliable
status field or an exact empty-state marker, ordinary assertions on those are
also a good fit. Classification is useful when you need to interpret the rendered
message across changing wording.
