# semantic-assert-playwright

Playwright adapter for `semantic-assert`.
Pages are captured as text (aria snapshot, URL, title), so claims are judged
on what a screen-reader user would get.

## Fixture

```ts
import { test as base } from "@playwright/test";
import {
  judgeFixtures,
  type JudgeFixtures,
  type JudgeFixtureOptions,
} from "semantic-assert-playwright";
import { typesafe } from "semantic-assert-typesafe";

// The provider is an object, so it is the option's default here rather than
// an entry in the config's `use` block, which is serialized to workers.
const test = base.extend<JudgeFixtures & JudgeFixtureOptions>({
  ...judgeFixtures,
  judgeProvider: [typesafe(), { option: true }],
});
test.use({ judgeOptions: { threshold: 0.8 } });

test("dashboard", async ({ page, judge }) => {
  await page.goto("/dashboard");
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor({ state: "visible" });
  await judge.expectPageTo("there is a heading with the text Projects");
  const state = await judge.classifyPage(
    "Which option best describes the main content?",
    { listed: "A table with project rows.", empty: "An invitation to create the first project." },
    { settled: ["listed", "empty"], timeoutMs: 5_000 },
  );
});
```

With playwright-bdd, extend its base test instead:

```ts
import {
  judgeFixtures,
  type JudgeFixtures,
  type JudgeFixtureOptions,
} from "semantic-assert-playwright";
import { typesafe } from "semantic-assert-typesafe";
import { createBdd, test as base } from "playwright-bdd";

export const test = base.extend<JudgeFixtures & JudgeFixtureOptions>({
  ...judgeFixtures,
  judgeProvider: [typesafe(), { option: true }],
});
export const { Given, When, Then } = createBdd(test);
```

`judgeOptions` accepts everything `resolveJudgeSettings` does: thresholds,
timing, state size and question templates. The adapter applies `pageTemplates`,
which name the captured page's fields, on top of the core defaults; pass
`templates` to replace any of them. It is plain data, so it can live in
the config's `use` for the whole suite, or in `test.use` per file or describe
block. `judgeProvider` is given where `test` is built, as above. Each call can still override
`threshold`, `timeoutMs`, `pollIntervalMs`, `region` (Locator or selector),
`includeLinks`, `extraState` and a `redact` hook that runs before anything is
sent to the API.

## Wait first, then judge once

The default `timeoutMs` is `0`: semantic assertions capture and evaluate once.
Use Playwright to wait for the target before judging its meaning:

```ts
const alert = page.getByRole("alert");
await alert.waitFor({ state: "visible" });
await judge.expectPageTo("The alert explains how to recover", { region: alert });
```

Visibility does not guarantee that content has finished updating. Wait for your
application's ready state as well when needed. To have the judge recapture changing
content, opt into polling with `{ timeoutMs: 5_000 }` on the assertion or in
`judgeOptions`. Provider request retries are configured separately.

## Visual hints

The aria snapshot carries semantic state (`[selected]`, `[pressed]`) but
nothing about how text looks. For claims such as "the cited passage is
highlighted", turn on `visualHints`:

```ts
await judge.expectPageTo("at least one passage is shown with a highlighted background", {
  region: page.locator(".document"),
  visualHints: { dataAttributes: ["data-highlight-kind"] },
});
```

The capture then adds a `visual_hints` list: for every visible text run whose
look departs from its surroundings, the element's own text plus named
observations such as `highlighted background (light blue)`, `bold`, `italic`,
`dimmed`, `struck through`, `red text`, and any requested data attributes as
`name=value`. Observations are words, not numbers, because models judge
"yellow background" far better than `rgb(255, 235, 59)`, and they are relative
to the parent element, so they hold across themes. Buttons, links and form
controls are excluded from the background hint to keep the list short. It is
off by default: it costs an extra in-page evaluation and tokens, and most
claims are about semantics. If the expected style is exact and known, prefer
Playwright's `toHaveCSS` or `toHaveClass`.

## Matchers

```ts
import { createJudgeExpect } from "semantic-assert-playwright";
import { typesafe } from "semantic-assert-typesafe";

export const expect = createJudgeExpect({ provider: typesafe() });

await expect(page).toSatisfy("there is a heading with the text Projects");
await expect(page.getByTestId("agent-panel")).toSatisfyAll([
  "the panel shows a conversation between the user and an agent",
  { claim: "an error is shown", expected: false },
]);
```

`.not` is rejected with an error: a claim that misses its threshold is not
evidence of the opposite. Use `{ claim, expected: false }`, which asks the
model for the negative directly.

## Reporter

```ts
reporter: [["list"], ["semantic-assert-playwright/reporter", { outputFile: "test-results/semantic-assert-metrics.json" }]],
```

Prints tokens, cost and provider wait per describe block (the Feature for
playwright-bdd) and per scenario, and writes the same as JSON. Cost is the
provider's per-call estimate from the rates you configured; "n/a" when none.

## Tests

```bash
pnpm --filter semantic-assert-playwright test
```
