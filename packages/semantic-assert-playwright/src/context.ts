// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { Page, TestInfo } from "@playwright/test";
import {
  type ChoiceAnswer,
  type Claim,
  type ClaimResult,
  type ClassifyOptions,
  type ExpectClaimsOptions,
  type JsonValue,
  Judge,
  type JudgeSettings,
  type JudgeSettingsOverrides,
  METRICS_ATTACHMENT,
  type Provider,
  type ProviderResult,
  type Questions,
  type ScenarioMetrics,
  describeUrl,
  resolveJudgeSettings,
} from "semantic-assert";

import { type CapturePageStateOptions, capturePageState } from "./page-state";
import { pageTemplates } from "./page-templates";

export interface PageAssertOptions extends CapturePageStateOptions, ExpectClaimsOptions {}
export interface PageClassifyOptions<Option extends string>
  extends CapturePageStateOptions, ClassifyOptions<Option> {}

export type PageJudgeOptions = JudgeSettingsOverrides;

/**
 * Scenario-scoped facade over the core Judge for one Playwright page. Evidence
 * for every judgment is attached to the test's report when a TestInfo is given.
 */
export class PageJudge {
  readonly judge: Judge;
  readonly settings: JudgeSettings;

  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo | undefined,
    provider: Provider,
    options: PageJudgeOptions = {},
  ) {
    this.settings = resolveJudgeSettings({
      ...options,
      templates: { ...pageTemplates, ...options.templates },
    });
    this.judge = new Judge({
      provider,
      settings: this.settings,
      hooks: {
        wait: (ms) => page.waitForTimeout(ms),
        attach: testInfo
          ? (name, body) =>
              testInfo.attach(name, {
                body: JSON.stringify(body, null, 2),
                contentType: "application/json",
              })
          : undefined,
      },
    });
  }

  private capture(options: CapturePageStateOptions) {
    return () => capturePageState(this.page, { maxChars: this.settings.maxStateChars, ...options });
  }

  /** Assert natural-language claims about the page, all in one model request. */
  expectPage(claims: readonly Claim[], options: PageAssertOptions = {}): Promise<ClaimResult[]> {
    return this.judge.expectClaims(this.capture(options), claims, options);
  }

  async expectPageTo(claim: string, options?: PageAssertOptions): Promise<ClaimResult> {
    const [result] = await this.expectPage([{ claim }], options);
    return result!;
  }

  async expectPageNotTo(claim: string, options?: PageAssertOptions): Promise<ClaimResult> {
    const [result] = await this.expectPage([{ claim, expected: false }], options);
    return result!;
  }

  /** Pick one option describing the page; polls until a `settled` option is chosen. */
  classifyPage<Option extends string>(
    instructions: string,
    criteria: Record<Option, string>,
    options: PageClassifyOptions<Option> = {},
  ): Promise<ChoiceAnswer<Option>> {
    return this.judge.classify(this.capture(options), instructions, criteria, options);
  }

  /** Assert a claim about the URL alone, sending only the parsed URL as state. */
  async expectUrl(claim: string, options: ExpectClaimsOptions = {}): Promise<ClaimResult> {
    const [result] = await this.judge.expectClaims(
      async () => describeUrl(this.page.url()),
      [{ claim }],
      {
        template: this.settings.templates.urlClaim,
        ...options,
      },
    );
    return result!;
  }

  /** Ask arbitrary questions over state a step assembled itself. */
  evaluate<Q extends Questions>(
    state: JsonValue,
    questions: Q,
    attachmentName?: string,
  ): Promise<ProviderResult<Q>> {
    return this.judge.evaluate(state, questions, attachmentName);
  }

  get metrics(): ScenarioMetrics {
    return this.judge.metrics;
  }

  /** Attach this scenario's usage for the metrics reporter. No-op without calls. */
  async attachMetrics(): Promise<void> {
    if (!this.testInfo || this.metrics.totals.calls === 0) return;
    await this.testInfo.attach(METRICS_ATTACHMENT, {
      body: JSON.stringify(this.metrics, null, 2),
      contentType: "application/json",
    });
  }
}
