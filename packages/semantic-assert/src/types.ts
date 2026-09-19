// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

/**
 * Question and answer shapes shared by every provider. They follow TypeSafe's
 * System One primitives because those are the most constrained: a provider
 * that can return a calibrated probability for a yes/no question and a
 * distribution over named options can implement everything the judge needs.
 */

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface NoulQuestion {
  type: "noul";
  instructions: JsonValue;
  criteria?: { true?: string; false?: string };
}

export interface ChoiceQuestion<Option extends string = string> {
  type: "choice";
  instructions: JsonValue;
  criteria: Record<Option, string | null>;
}

export type Question = NoulQuestion | ChoiceQuestion;
export type Questions = Record<string, Question>;

export interface NoulAnswer {
  type: "noul";
  /** Probability that the answer is "yes", from 0 to 1. */
  noul: number;
}

export interface ChoiceAnswer<Option extends string = string> {
  type: "choice";
  choice: Option;
  /** Certainty in the chosen option, from 0 to 1, derived from the distribution. */
  confidence: number;
  probabilities: Record<Option, number>;
}

export type AnswerFor<Q extends Question> = Q extends NoulQuestion
  ? NoulAnswer
  : Q extends ChoiceQuestion<infer Option>
    ? ChoiceAnswer<Option>
    : never;

export type AnswersFor<Q extends Questions> = { [K in keyof Q]: AnswerFor<Q[K]> };

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
}

/** What a provider returns for one evaluation. */
export interface ProviderResult<Q extends Questions> {
  answers: AnswersFor<Q>;
  /** Versioned model identifier that produced the answers. */
  model: string;
  usage?: ProviderUsage;
  /** Cost of this call as the provider prices it; omit when unknown. */
  costUsd?: number;
  /** Attempts the provider needed, when it retries internally. */
  attempts?: number;
}

/**
 * Anything that can answer questions about state. Implementations live in
 * their own packages so the core carries no vendor SDK. All questions in one
 * call see the same state and are independent of each other.
 */
export interface Provider {
  readonly name: string;
  evaluate<Q extends Questions>(state: JsonValue, questions: Q): Promise<ProviderResult<Q>>;
}

export function noul(instructions: JsonValue, criteria?: NoulQuestion["criteria"]): NoulQuestion {
  return criteria ? { type: "noul", instructions, criteria } : { type: "noul", instructions };
}

export function choice<Option extends string>(
  instructions: JsonValue,
  criteria: Record<Option, string | null>,
): ChoiceQuestion<Option> {
  return { type: "choice", instructions, criteria };
}
