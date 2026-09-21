import { createBdd, test as base } from "playwright-bdd";
import type { JsonValue } from "semantic-assert";
import {
  judgeFixtures,
  type JudgeFixtures,
  type JudgeFixtureOptions,
} from "semantic-assert-playwright";
import { exampleProvider } from "../../support/provider.js";

/**
 * Scripted, not judged. The fake keys on the alert copy so the three scenarios
 * play out deterministically without an API key. A live provider reads the text.
 */
function scriptedByContent(state: JsonValue) {
  const complete = /try again|another try/i.test(JSON.stringify(state));
  return { claim_0: complete ? 0.97 : 0.03 };
}

// Extend playwright-bdd's test, not Playwright's, so steps can use `judge`.
export const test = base.extend<JudgeFixtures & JudgeFixtureOptions>({
  ...judgeFixtures,
  judgeProvider: async ({}, provide) => {
    await provide(exampleProvider({ respond: scriptedByContent }));
  },
  judgeOptions: [{ threshold: 0.8 }, { option: true }],
});

export const { Given, When, Then } = createBdd(test);
