import { test as base } from "@playwright/test";
import {
  judgeFixtures,
  type JudgeFixtures,
  type JudgeFixtureOptions,
} from "semantic-assert-playwright";
import { exampleProvider } from "../support/provider.js";

export const test = base.extend<JudgeFixtures & JudgeFixtureOptions>({
  ...judgeFixtures,
  // A fresh provider per test keeps scripted answers and request history isolated.
  judgeProvider: async ({}, provide) => {
    await provide(exampleProvider({ scripts: [{ claim_0: 0.99, claim_1: 0.98, claim_2: 0.01 }] }));
  },
  judgeOptions: [{ threshold: 0.8, timeoutMs: 5_000, pollIntervalMs: 100 }, { option: true }],
});

export { expect } from "@playwright/test";
