// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { type Fixtures, type PlaywrightTestArgs, test as base } from "@playwright/test";
import type { Provider } from "semantic-assert";

import { PageJudge, type PageJudgeOptions } from "./context";

/**
 * Suite-level options. `judgeOptions` (thresholds, timing, templates) is plain
 * data and can live in the Playwright config's `use` block. `judgeProvider`
 * holds a Provider instance, which is not serializable, so give it as the
 * option's default where `test` is built:
 *
 *   base.extend({ ...judgeFixtures, judgeProvider: [typesafe(), { option: true }] })
 *
 * `test.use({ judgeProvider })` also works inside a test file or describe
 * block, but not at module scope of a file that tools import outside a test.
 */
export interface JudgeFixtureOptions {
  judgeOptions: PageJudgeOptions;
  judgeProvider: Provider | undefined;
}

export interface JudgeFixtures {
  /** Scenario-scoped judge: page judgments plus cross-step memory. */
  judge: PageJudge;
}

/**
 * Fixture definitions to extend any Playwright `test` with, including the one
 * from playwright-bdd: `createBdd(bddBase.extend(judgeFixtures))`.
 */
export const judgeFixtures: Fixtures<
  JudgeFixtures & JudgeFixtureOptions,
  object,
  PlaywrightTestArgs
> = {
  judgeOptions: [{}, { option: true }],
  judgeProvider: [undefined, { option: true }],
  // The second argument hands the value to the test. Named `provide` rather
  // than the conventional `use` so React hooks lint rules do not flag it.
  judge: async ({ page, judgeOptions, judgeProvider }, provide, testInfo) => {
    if (!judgeProvider) {
      throw new Error(
        "No semantic-assert provider configured. Set it where `test` is built: base.extend({ ...judgeFixtures, judgeProvider: [typesafe(), { option: true }] }).",
      );
    }
    const judge = new PageJudge(page, testInfo, judgeProvider, judgeOptions);
    await provide(judge);
    // Teardown: record what this scenario spent on the model.
    await judge.attachMetrics();
  },
};

/** Plain Playwright `test` with the `judge` fixture and its options. */
export const test = base.extend<JudgeFixtures & JudgeFixtureOptions>(judgeFixtures);
