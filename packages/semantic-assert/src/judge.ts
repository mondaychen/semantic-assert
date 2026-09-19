// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

/**
 * Framework-agnostic judging engine. It knows nothing about browsers: a
 * `Capture` function hands it JSON state, a `wait` function pauses between
 * polls, and an optional `attach` hook receives evidence for the test report.
 */

import { type CallMetrics, type ScenarioMetrics, summarizeCalls } from "./metrics";
import {
  type ClaimTemplate,
  type ClassificationTemplate,
  type JudgeSettings,
  assertValidThreshold,
} from "./settings";
import type { ChoiceAnswer, JsonValue, Provider, ProviderResult, Questions } from "./types";

/**
 * Thrown by a `Capture` when the state cannot be produced yet (a region has
 * not rendered, a response has not arrived). The engine retries until the
 * deadline, then lets the error surface.
 */
export class NotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotReadyError";
  }
}

/** Produces the state to judge. Throw `NotReadyError` to ask for another poll. */
export type Capture = () => Promise<JsonValue>;

export interface JudgeHooks {
  /** Pause between polls, e.g. Playwright's page.waitForTimeout. Defaults to a timer. */
  wait?: (ms: number) => Promise<void>;
  /** Receive evidence (answers, judged state) for the test report. */
  attach?: (name: string, body: unknown) => Promise<void>;
}

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface Claim {
  claim: string;
  /** Expect the claim to be true (default) or false. */
  expected?: boolean;
  /** Pass threshold for this claim only. */
  threshold?: number;
}

export interface ClaimResult {
  claim: string;
  expected: boolean;
  probability: number;
  /** The pass threshold this claim was judged against. */
  threshold: number;
  passed: boolean;
}

export interface TimingOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface ExpectClaimsOptions extends TimingOptions {
  /** Pass threshold for every claim that has none of its own. */
  threshold?: number;
  /** Question wording; defaults to the settings' `claim` template. */
  template?: ClaimTemplate;
}

export interface ClassifyOptions<Option extends string> extends TimingOptions {
  /**
   * Options that count as a settled state. State is re-captured while the
   * chosen option is not one of these, until the timeout, when the last answer
   * is returned regardless. Omit to accept the first answer. Leave out options
   * the caller treats as failures, so a half-rendered page that looks like an
   * error keeps polling instead of failing early.
   */
  settled?: readonly NoInfer<Option>[];
  /** Question wording; defaults to the settings' `classification` template. */
  template?: ClassificationTemplate;
}

export class SemanticAssertionError extends Error {
  constructor(
    message: string,
    public readonly results: ClaimResult[],
  ) {
    super(message);
    this.name = "SemanticAssertionError";
  }
}

export function formatClaimResults(results: readonly ClaimResult[]): string {
  return results
    .map(
      (r) =>
        `  ${r.passed ? "PASS" : "FAIL"}  p(yes)=${r.probability.toFixed(2)}  threshold ${r.threshold}  expected ${
          r.expected ? "true" : "false"
        }: "${r.claim}"`,
    )
    .join("\n");
}

export interface JudgeOptions {
  provider: Provider;
  settings: JudgeSettings;
  hooks?: JudgeHooks;
}

export class Judge {
  readonly provider: Provider;
  readonly settings: JudgeSettings;
  private readonly wait: (ms: number) => Promise<void>;
  private readonly attachHook: JudgeHooks["attach"];
  private readonly calls: CallMetrics[] = [];

  constructor(options: JudgeOptions) {
    this.provider = options.provider;
    this.settings = options.settings;
    this.wait = options.hooks?.wait ?? defaultWait;
    this.attachHook = options.hooks?.attach;
  }

  /** Usage so far. */
  get metrics(): ScenarioMetrics {
    return summarizeCalls(this.calls);
  }

  /** Ask the provider and record what the call cost. */
  private async ask<Q extends Questions>(
    state: JsonValue,
    questions: Q,
  ): Promise<ProviderResult<Q>> {
    const startedAt = performance.now();
    const result = await this.provider.evaluate(state, questions);
    this.calls.push({
      model: result.model,
      questionCount: Object.keys(questions).length,
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      waitMs: performance.now() - startedAt,
      attempts: result.attempts ?? 1,
      ...(result.costUsd !== undefined ? { costUsd: result.costUsd } : {}),
    });
    return result;
  }

  private timing(options: TimingOptions): { timeoutMs: number; pollIntervalMs: number } {
    return {
      timeoutMs: options.timeoutMs ?? this.settings.timeoutMs,
      pollIntervalMs: options.pollIntervalMs ?? this.settings.pollIntervalMs,
    };
  }

  /** Capture state, or return null while the capture is not ready and time remains. */
  private async captureOrWait(
    capture: Capture,
    deadline: number,
    pollIntervalMs: number,
  ): Promise<JsonValue | null> {
    try {
      return await capture();
    } catch (error) {
      if (error instanceof NotReadyError && Date.now() + pollIntervalMs <= deadline) return null;
      throw error;
    }
  }

  private async attach(name: string, body: unknown): Promise<void> {
    await this.attachHook?.(name, body);
  }

  /**
   * Assert claims about captured state. All claims go to the model in one
   * request. State is re-captured until every claim passes or the timeout
   * elapses, mirroring auto-retrying UI assertions.
   */
  async expectClaims(
    capture: Capture,
    claims: readonly Claim[],
    options: ExpectClaimsOptions = {},
  ): Promise<ClaimResult[]> {
    if (claims.length === 0) throw new Error("expectClaims needs at least one claim");
    const threshold = options.threshold ?? this.settings.threshold;
    if (options.threshold !== undefined) assertValidThreshold(threshold, "assertion option");
    for (const { claim, threshold: own } of claims) {
      if (own !== undefined) assertValidThreshold(own, `claim "${claim}"`);
    }
    const { timeoutMs, pollIntervalMs } = this.timing(options);
    const template = options.template ?? this.settings.templates.claim;
    const questions = Object.fromEntries(
      claims.map(({ claim }, i) => [`claim_${i}`, template(claim)]),
    );

    const deadline = Date.now() + timeoutMs;
    let lastResults: ClaimResult[] = [];
    let lastState: JsonValue = null;
    let polls = 0;

    for (;;) {
      const state = await this.captureOrWait(capture, deadline, pollIntervalMs);
      if (state === null) {
        await this.wait(pollIntervalMs);
        continue;
      }
      polls += 1;
      lastState = state;
      const { answers, usage, model } = await this.ask(state, questions);

      lastResults = claims.map(({ claim, expected = true, threshold: own }, i) => {
        const probability = answers[`claim_${i}`]?.noul ?? Number.NaN;
        const required = own ?? threshold;
        const passed = expected ? probability >= required : probability <= 1 - required;
        return { claim, expected, probability, threshold: required, passed };
      });

      const summary = { model, polls, usage, results: lastResults };
      if (lastResults.every((r) => r.passed)) {
        await this.attach("semantic-answers", summary);
        return lastResults;
      }
      if (Date.now() + pollIntervalMs > deadline) {
        await this.attach("semantic-answers", summary);
        await this.attach("semantic-state", lastState);
        throw new SemanticAssertionError(
          `The model did not agree with the claims after ${polls} poll(s) over ${timeoutMs}ms:\n${formatClaimResults(lastResults)}\nSee the "semantic-state" attachment for the state that was judged.`,
          lastResults,
        );
      }
      await this.wait(pollIntervalMs);
    }
  }

  /**
   * Pick one option describing the captured state. Re-captures until the
   * choice is one of `settled` or the timeout elapses. Returns the raw answer
   * so the acceptance policy stays with the caller.
   */
  async classify<Option extends string>(
    capture: Capture,
    instructions: string,
    criteria: Record<Option, string>,
    options: ClassifyOptions<Option> = {},
  ): Promise<ChoiceAnswer<Option>> {
    const { timeoutMs, pollIntervalMs } = this.timing(options);
    const settled = options.settled === undefined ? null : new Set<Option>(options.settled);
    const template = options.template ?? this.settings.templates.classification;
    const question = template(instructions, criteria);

    const deadline = Date.now() + timeoutMs;
    let polls = 0;
    for (;;) {
      const state = await this.captureOrWait(capture, deadline, pollIntervalMs);
      if (state === null) {
        await this.wait(pollIntervalMs);
        continue;
      }
      polls += 1;
      const { answers, model } = await this.ask(state, { classification: question });
      const answer = answers.classification;
      const isSettled = settled === null || settled.has(answer.choice);
      if (isSettled || Date.now() + pollIntervalMs > deadline) {
        await this.attach("semantic-classification", {
          model,
          polls,
          settled: isSettled,
          instructions,
          answer,
          ...(isSettled ? {} : { state }),
        });
        return answer;
      }
      await this.wait(pollIntervalMs);
    }
  }

  /**
   * Ask arbitrary questions over state the caller assembled. Answers are
   * attached; the caller applies the policy.
   */
  async evaluate<Q extends Questions>(
    state: JsonValue,
    questions: Q,
    attachmentName = "semantic-evaluation",
  ): Promise<ProviderResult<Q>> {
    const result = await this.ask(state, questions);
    await this.attach(attachmentName, {
      model: result.model,
      usage: result.usage,
      state,
      answers: result.answers,
    });
    return result;
  }
}
