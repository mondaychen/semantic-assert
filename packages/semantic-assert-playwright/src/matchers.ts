// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { type Locator, type Page, expect as baseExpect, test } from "@playwright/test";
import {
  type Claim,
  type Provider,
  SemanticAssertionError,
  formatClaimResults,
} from "semantic-assert";

import { PageJudge, type PageAssertOptions, type PageJudgeOptions } from "./context";

export interface MatcherConfig {
  provider: Provider;
  /** Defaults for every matcher call; the config's `judgeOptions` are merged under these. */
  options?: PageJudgeOptions;
}

function isPage(value: Page | Locator): value is Page {
  return "goto" in value;
}

/**
 * Build `expect.extend` matchers bound to a provider:
 *
 *   export const expect = baseExpect.extend(createJudgeMatchers({ provider: typesafe() }));
 *   await expect(page).toSatisfy("there is a heading with the text Projects");
 *   await expect(locator).toSatisfyAll(["...", { claim: "...", expected: false }]);
 *
 * Negation via `.not` is not supported; pass `{ expected: false }` claims.
 */
export function createJudgeMatchers(config: MatcherConfig) {
  function judgeFor(received: Page | Locator) {
    const page = isPage(received) ? received : received.page();
    // test.info() throws outside a test; matchers only run inside one.
    const info = test.info();
    const fromConfig = (info.project.use as { judgeOptions?: PageJudgeOptions }).judgeOptions;
    return {
      judge: new PageJudge(page, info, config.provider, { ...fromConfig, ...config.options }),
      region: isPage(received) ? undefined : received,
    };
  }

  async function run(received: Page | Locator, claims: Claim[], options: PageAssertOptions) {
    const { judge, region } = judgeFor(received);
    try {
      const results = await judge.expectPage(claims, { region, ...options });
      await judge.attachMetrics();
      return { pass: true, message: () => `The model agreed:\n${formatClaimResults(results)}` };
    } catch (error) {
      await judge.attachMetrics();
      if (error instanceof SemanticAssertionError)
        return { pass: false, message: () => error.message };
      throw error;
    }
  }

  return {
    toSatisfy(received: Page | Locator, claim: string, options: PageAssertOptions = {}) {
      return run(received, [{ claim }], options);
    },
    toSatisfyAll(
      received: Page | Locator,
      claims: Array<string | Claim>,
      options: PageAssertOptions = {},
    ) {
      return run(
        received,
        claims.map((c) => (typeof c === "string" ? { claim: c } : c)),
        options,
      );
    },
  };
}

/** `expect` extended with the matchers for a given provider. */
export function createJudgeExpect(config: MatcherConfig) {
  return baseExpect.extend(createJudgeMatchers(config));
}
