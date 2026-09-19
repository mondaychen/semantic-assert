// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type {
  AnswersFor,
  ChoiceQuestion,
  JsonValue,
  Provider,
  ProviderResult,
  Questions,
} from "./types";

/** A scripted answer for one question: a probability for Noul, an option for Choice. */
export type ScriptedAnswer = number | { choice: string; confidence?: number };

/** Answers for one call, keyed by question id. Missing ids default to 0 / the first option. */
export type Script = Record<string, ScriptedAnswer>;

export interface FakeProviderOptions {
  /** One script per call; the last one repeats once exhausted. */
  scripts?: readonly Script[];
  /** Or compute answers from the request. Takes precedence over `scripts`. */
  respond?: (state: JsonValue, questions: Questions, callIndex: number) => Script;
  model?: string;
  usage?: { inputTokens: number; outputTokens: number };
  costUsd?: number;
}

/**
 * Deterministic provider for tests and for consumers' own unit tests. Records
 * every request so assertions can inspect what would have been sent.
 */
export class FakeProvider implements Provider {
  readonly name = "fake";
  readonly requests: Array<{ state: JsonValue; questions: Questions }> = [];

  constructor(private readonly options: FakeProviderOptions = {}) {}

  async evaluate<Q extends Questions>(state: JsonValue, questions: Q): Promise<ProviderResult<Q>> {
    const index = this.requests.length;
    this.requests.push({ state, questions });
    const scripts = this.options.scripts ?? [];
    const script =
      this.options.respond?.(state, questions, index) ??
      scripts[Math.min(index, scripts.length - 1)] ??
      {};

    const answers = Object.fromEntries(
      Object.entries(questions).map(([id, question]) => {
        const scripted = script[id];
        if (question.type === "choice") {
          const options = Object.keys((question as ChoiceQuestion).criteria);
          const chosen = typeof scripted === "object" ? scripted.choice : (options[0] ?? "");
          const confidence = typeof scripted === "object" ? (scripted.confidence ?? 1) : 1;
          const probabilities = Object.fromEntries(
            options.map((o) => [o, o === chosen ? confidence : 0]),
          );
          return [id, { type: "choice", choice: chosen, confidence, probabilities }];
        }
        return [id, { type: "noul", noul: typeof scripted === "number" ? scripted : 0 }];
      }),
    ) as AnswersFor<Q>;

    return {
      answers,
      model: this.options.model ?? "fake-1",
      usage: this.options.usage ?? { inputTokens: 10, outputTokens: 1 },
      ...(this.options.costUsd !== undefined ? { costUsd: this.options.costUsd } : {}),
    };
  }
}
