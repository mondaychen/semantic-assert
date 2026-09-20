// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { type ChoiceQuestion, type NoulQuestion, choice, noul } from "./types";

/**
 * How a plain-English claim becomes a Noul question. Models read instructions
 * literally, so a template should name the state fields to look at and define
 * both outcomes. Override to change wording, language, or state layout.
 */
export type ClaimTemplate = (claim: string) => NoulQuestion;

/** How a classification request becomes a Choice question. */
export type ClassificationTemplate = <Option extends string>(
  instructions: string,
  criteria: Record<Option, string>,
) => ChoiceQuestion<Option>;

export interface JudgeTemplates {
  /** Claims about whatever JSON state the caller captured. */
  claim: ClaimTemplate;
  /** Claims about a parsed URL (state from `describeUrl`). */
  urlClaim: ClaimTemplate;
  classification: ClassificationTemplate;
}

/**
 * Defaults that assume nothing about the state's shape. Adapters that capture
 * a known layout (a web page, say) supply templates naming its fields, which
 * helps the model considerably.
 */
export const defaultTemplates: JudgeTemplates = {
  claim: (claim) =>
    noul(
      {
        statement: claim,
        question:
          "Is `statement` supported by the supplied JSON state? Use only that state as evidence.",
      },
      {
        true: "The state clearly shows the statement holds.",
        false: "The state does not show it, or shows the opposite.",
      },
    ),
  urlClaim: (claim) =>
    noul(
      {
        statement: claim,
        question:
          "Is `statement` true of the URL described by `url`, `pathname`, `path_segments`, and `query_params`?",
      },
      {
        true: "The URL clearly matches the statement.",
        false: "The URL does not match the statement.",
      },
    ),
  classification: (instructions, criteria) =>
    choice(
      {
        question: instructions,
        note: "Classify using only the supplied JSON state as evidence.",
      },
      criteria,
    ),
};

/**
 * Suite-level settings. Resolve once per scenario from, in order of
 * precedence: explicit overrides (e.g. a Playwright option), the SEMANTIC_ASSERT_*
 * environment variables, then built-in defaults. Any single assertion can
 * still override the numbers through its options.
 */
export interface JudgeSettings {
  /** Pass probability for a positive claim; negated claims need `1 - threshold`. */
  threshold: number;
  /**
   * How long an assertion keeps re-capturing state while a claim fails.
   * Defaults to 0: capture and evaluate once, without polling. It
   * bounds polling, not a single provider request: a call already in flight
   * runs to completion under the provider's own timeout and retry settings.
   */
  timeoutMs: number;
  /** Pause between polls. Each poll is one model request. */
  pollIntervalMs: number;
  /**
   * Character cap on the largest text field of a captured state. A System One model's budget
   * is ~32k tokens for state plus the longest question, and accuracy drops
   * with irrelevant bulk.
   */
  maxStateChars: number;
  templates: JudgeTemplates;
}

export interface JudgeSettingsOverrides {
  threshold?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
  maxStateChars?: number;
  templates?: Partial<JudgeTemplates>;
}

const BUILT_IN: Omit<JudgeSettings, "templates"> = {
  threshold: 0.7,
  timeoutMs: 0,
  pollIntervalMs: 1_000,
  maxStateChars: 40_000,
};

/** Environment variable lookup that tolerates runtimes without a `process` global. */
function readEnv(name: string): string | undefined {
  return typeof process === "undefined" ? undefined : process.env?.[name];
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number, got "${raw}"`);
  return value;
}

/**
 * A Noul near 0.5 gives yes and no equal probability, so a pass threshold
 * below that would accept claims the model leans against.
 */
export function assertValidThreshold(threshold: number, source: string): void {
  if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1) {
    throw new Error(`${source}: threshold must be between 0.5 and 1, got ${threshold}`);
  }
}

/**
 * Timing values are durations in milliseconds. A negative interval would let a
 * poll loop outlive its deadline, so both must be finite and non-negative.
 */
export function assertValidDuration(value: number, name: string, source: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${source}: ${name} must be a non-negative number of milliseconds, got ${value}`,
    );
  }
}

export function resolveJudgeSettings(overrides: JudgeSettingsOverrides = {}): JudgeSettings {
  const settings: JudgeSettings = {
    threshold:
      overrides.threshold ?? readNumberEnv("SEMANTIC_ASSERT_THRESHOLD", BUILT_IN.threshold),
    timeoutMs:
      overrides.timeoutMs ?? readNumberEnv("SEMANTIC_ASSERT_TIMEOUT_MS", BUILT_IN.timeoutMs),
    pollIntervalMs:
      overrides.pollIntervalMs ?? readNumberEnv("SEMANTIC_ASSERT_POLL_MS", BUILT_IN.pollIntervalMs),
    maxStateChars:
      overrides.maxStateChars ??
      readNumberEnv("SEMANTIC_ASSERT_MAX_STATE_CHARS", BUILT_IN.maxStateChars),
    templates: { ...defaultTemplates, ...overrides.templates },
  };
  assertValidThreshold(settings.threshold, "judge settings");
  assertValidDuration(settings.timeoutMs, "timeoutMs", "judge settings");
  assertValidDuration(settings.pollIntervalMs, "pollIntervalMs", "judge settings");
  return settings;
}
