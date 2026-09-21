---
title: BDD scenarios with playwright-bdd
description: Turn Gherkin steps into semantic claims with playwright-bdd, so the feature file states the requirement and the step definition stops checking strings.
---

# BDD scenarios with playwright-bdd

<p class="page-hook">Your Gherkin reads like the PRD... but your steps just check a string.</p>

Behavior-driven development promised scenarios a PM could read and sign off. Then
the step definitions arrived, and the only way to make a step pass was to put the
exact copy in it.

## Before: the copy lives in the feature file

```gherkin
Scenario: A failed save is explained
  Given the editor failed to save the user's changes
  Then I should see the message "We couldn't save your changes. Try again."
```

```ts
Then("I should see the message {string}", async ({ page }, text: string) => {
  await expect(page.getByRole("alert")).toHaveText(text);
});
```

Now the PM's copy edit is a change to the feature file, the scenario says nothing
about what the alert is for, and "I should see" is a step about the implementation,
not the behavior. The scenario reads like a screenshot, not a requirement.

## After: the step is the claim

Extend playwright-bdd's `test` with the judge fixtures, the same way you'd extend
Playwright's:

```ts
// steps/fixtures.ts
import { createBdd, test as base } from "playwright-bdd";
import {
  judgeFixtures,
  type JudgeFixtures,
  type JudgeFixtureOptions,
} from "semantic-assert-playwright";
import { typesafe } from "semantic-assert-typesafe";

export const test = base.extend<JudgeFixtures & JudgeFixtureOptions>({
  ...judgeFixtures,
  judgeProvider: [typesafe(), { option: true }],
});

export const { Given, When, Then } = createBdd(test);
```

Then write the scenario the way the requirement is written, and let one step
definition turn every `Then the alert ...` line into a claim:

```gherkin
Scenario: A failed save tells the user what happened and what to do
  Given the editor failed to save the user's changes
  Then the alert tells the user their changes were not saved
  And the alert tells the user how to recover
```

```ts
// steps/alert.steps.ts
Then(/^the alert (.+)$/, async ({ page, judge }, requirement: string) => {
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await judge.expectPageTo(`The alert ${requirement}`, { region: alert });
});
```

The Gherkin text is the claim. A new requirement is a new line in the feature
file, not a new step definition, and a copy edit touches neither. Visibility stays
in an ordinary Playwright assertion, and the capture is scoped to the alert so
help text elsewhere on the page can't fill in what the alert is missing.

::: tip One step, many claims
The regex step is the whole trick. Every `Then the alert ...` phrase your PM can
write becomes a semantic assertion with no extra code. Keep the prefix specific,
here "the alert", so the model knows what the claim is about and the step can
scope the capture to it.
:::

## Keep a real regression in the feature file

Gherkin makes the calibration set part of the spec. Use playwright-bdd's `@fail`
tag for the scenario that must not pass:

```gherkin
Scenario: A reworded alert still meets the requirement
  Given the editor shows the alert "Your changes haven't been saved. Please give it another try."
  Then the alert tells the user their changes were not saved
  And the alert tells the user how to recover

@fail
Scenario: A vague alert does not meet the requirement
  Given the editor shows the alert "Something went wrong."
  Then the alert tells the user how to recover
```

| Scenario                                      | Intended outcome         | Why                                     |
| --------------------------------------------- | ------------------------ | --------------------------------------- |
| A failed save tells the user what happened... | Pass                     | The original copy meets both claims.    |
| A reworded alert still meets the requirement  | Pass                     | Different words, same information.      |
| A vague alert does not meet the requirement   | Fail, as `@fail` expects | Nothing tells the user what to do next. |

::: warning Pitfall
`@fail` means "this scenario is expected to fail". If someone fixes the vague copy
without removing the tag, the run goes red for the opposite reason. That's the
point: the tag documents an intended rejection, and Playwright holds you to it.
:::

## Run the example

From a checkout of the repository:

```sh
pnpm install
pnpm build
pnpm exec playwright install chromium
pnpm --filter semantic-assert-examples test:bdd
```

`test:bdd` runs `bddgen`, which generates specs from the feature files, then runs
them with a dedicated Playwright config. The default provider is a fake that keys
on the alert copy, so the three scenarios play out deterministically without an
API key. It doesn't read the text. For real judgments, put `AI_GATEWAY_API_KEY`
in `.env` and run:

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env examples/node_modules/playwright-bdd/dist/cli/index.js -c examples/playwright-bdd.config.ts
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright-bdd.config.ts
```

Each `Then` step is one evaluation with one claim, so the three scenarios make five
requests. The usage reporter groups them by Feature, which is what you'll want
when a suite has many.

The [feature file](https://github.com/mondaychen/semantic-assert/blob/main/examples/bdd/features/saving-changes.feature),
[step definitions](https://github.com/mondaychen/semantic-assert/blob/main/examples/bdd/steps/alert.steps.ts),
and [fixtures](https://github.com/mondaychen/semantic-assert/blob/main/examples/bdd/steps/fixtures.ts)
are in the repository.

## Use it in your suite

Keep your existing `Given` and `When` steps. They drive the app, and that doesn't
change. Replace the `Then` steps that quote copy with steps that state the
requirement, and give each one a regex that names its subject: `the alert`,
`the confirmation`, `the reply`. Batch related claims into one `expectPage` call
when a scenario has several `Then` lines about the same region and you want one
request instead of one per line.
