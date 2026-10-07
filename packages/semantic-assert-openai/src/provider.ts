// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { AsyncLocalStorage } from "node:async_hooks";

import OpenAI from "openai";
import type {
  AnswersFor,
  JsonValue,
  NoulQuestion,
  Provider,
  ProviderResult,
  Question,
  Questions,
} from "semantic-assert";

type DecisionQuestion = OpenAI.DecisionCreateParams["questions"][number];
type DecisionAnswer = OpenAI.Decision["answers"][number];

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface OpenAIDecisionsProviderOptions {
  /** Defaults to `OPENAI_API_KEY`. */
  apiKey?: string;
  /** Defaults to `OPENAI_BASE_URL`, then https://api.openai.com/v1. */
  baseUrl?: string;
  /** Defaults to `OPENAI_ORG_ID`. */
  organization?: string;
  /** Defaults to `OPENAI_PROJECT_ID`. */
  project?: string;
  /** Defaults to gpt-6-luna, the only model the Decisions API supports at launch. */
  model?: string;
  /** Per-attempt timeout; defaults to 10,000 ms. */
  timeoutMs?: number;
  /** SDK retries for connection errors, 408, 409, 429, and 5xx; defaults to 2. */
  maxRetries?: number;
  /** Opaque end-user identifier, sent as `safety_identifier`. */
  safetyIdentifier?: string;
  /**
   * USD per million input tokens, used to estimate each call's cost. Decisions
   * bills input tokens only. Defaults to OPENAI_DECISIONS_USD_PER_MTOK_INPUT;
   * when neither is set, cost is reported as unknown.
   */
  usdPerMtokInput?: number;
  /** Transport override, mainly for tests. Defaults to the global fetch. */
  fetch?: FetchLike;
}

/** The API declined to answer one or more questions. */
export class DecisionRefusalError extends Error {
  constructor(public readonly questions: string[]) {
    super(
      `OpenAI Decisions declined to answer ${questions.map((id) => `"${id}"`).join(", ")}. ` +
        "Rephrase the claim or check the captured state for content the model will not judge.",
    );
    this.name = "DecisionRefusalError";
  }
}

function readPrice(override?: number): number | undefined {
  if (override !== undefined) {
    if (!Number.isFinite(override) || override < 0) {
      throw new Error(`usdPerMtokInput must be a non-negative number, got ${override}`);
    }
    return override;
  }
  const raw = process.env.OPENAI_DECISIONS_USD_PER_MTOK_INPUT?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `OPENAI_DECISIONS_USD_PER_MTOK_INPUT must be a non-negative number, got "${raw}"`,
    );
  }
  return value;
}

// Decisions takes text only. Structured state and instructions travel as compact JSON.
function toText(value: JsonValue): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Predicates have no criteria field, so the true/false descriptions travel as
 * JSON fields beside the instructions. Measured against gpt-6-luna, appending
 * them as prose ("True when: ...") drove clearly true claims to near zero.
 */
function withCriteria({ instructions, criteria }: NoulQuestion): JsonValue {
  if (!criteria?.true && !criteria?.false) return instructions;
  const fields = {
    ...(criteria.true ? { true_when: criteria.true } : {}),
    ...(criteria.false ? { false_when: criteria.false } : {}),
  };
  const isObject =
    typeof instructions === "object" && instructions !== null && !Array.isArray(instructions);
  return isObject && !("true_when" in instructions) && !("false_when" in instructions)
    ? { ...instructions, ...fields }
    : { instructions, ...fields };
}

function toDecisionQuestion(name: string, question: Question): DecisionQuestion {
  if (question.type === "noul") {
    return { name, type: "predicate", instructions: toText(withCriteria(question)) };
  }
  return {
    name,
    type: "choice",
    instructions: toText(question.instructions),
    choices: Object.entries(question.criteria).map(([value, description]) =>
      description === null ? { value } : { value, description },
    ),
  };
}

function toAnswers<Q extends Questions>(answers: DecisionAnswer[], questions: Q): AnswersFor<Q> {
  const byName = new Map(answers.map((answer) => [answer.name, answer]));
  const refused: string[] = [];
  const result: Record<string, unknown> = {};
  for (const [id, question] of Object.entries(questions) as Array<[string, Question]>) {
    const answer = byName.get(id);
    if (answer?.type === "refusal") {
      refused.push(id);
    } else if (question.type === "noul" && answer?.type === "predicate") {
      result[id] = { type: "noul", noul: answer.probability };
    } else if (
      question.type === "choice" &&
      answer?.type === "choice" &&
      String(answer.choice) in question.criteria
    ) {
      result[id] = {
        type: "choice",
        choice: String(answer.choice),
        confidence: answer.confidence,
        probabilities: Object.fromEntries(
          answer.probabilities.map(({ value, probability }) => [String(value), probability]),
        ),
      };
    } else {
      const expected = question.type === "noul" ? "predicate" : "choice";
      throw new Error(`OpenAI Decisions response is missing a ${expected} answer for "${id}"`);
    }
  }
  if (refused.length > 0) throw new DecisionRefusalError(refused);
  return result as AnswersFor<Q>;
}

// Counts HTTP attempts per evaluate call, so overlapping calls keep separate counts.
const attemptCounter = new AsyncLocalStorage<{ count: number }>();

/** OpenAI's Decisions API as a semantic-assert provider. */
export class OpenAIDecisionsProvider implements Provider {
  readonly name = "openai";
  readonly model: string;
  private readonly options: OpenAIDecisionsProviderOptions;
  private readonly usdPerMtokInput: number | undefined;
  private clientInstance: OpenAI | undefined;

  constructor(options: OpenAIDecisionsProviderOptions = {}) {
    const timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive integer");
    }
    if (
      options.maxRetries !== undefined &&
      (!Number.isInteger(options.maxRetries) || options.maxRetries < 0)
    ) {
      throw new Error("maxRetries must be a non-negative integer");
    }
    this.options = options;
    this.model = options.model ?? "gpt-6-luna";
    this.usdPerMtokInput = readPrice(options.usdPerMtokInput);
  }

  /**
   * Created on first use so that `openaiDecisions()` can be called at module
   * load (e.g. in a Playwright fixtures file) before the API key is validated.
   */
  get client(): OpenAI {
    if (!this.clientInstance) {
      const transport = this.options.fetch ?? fetch;
      this.clientInstance = new OpenAI({
        apiKey: this.options.apiKey,
        baseURL: this.options.baseUrl,
        organization: this.options.organization,
        project: this.options.project,
        timeout: this.options.timeoutMs ?? 10_000,
        maxRetries: this.options.maxRetries ?? 2,
        fetch: (input, init) => {
          const counter = attemptCounter.getStore();
          if (counter) counter.count += 1;
          return transport(input, init);
        },
      });
    }
    return this.clientInstance;
  }

  async evaluate<Q extends Questions>(state: JsonValue, questions: Q): Promise<ProviderResult<Q>> {
    if (Object.keys(questions).length === 0) {
      throw new Error("evaluate requires at least one question");
    }
    const client = this.client;
    const counter = { count: 0 };
    const decision = await attemptCounter.run(counter, () =>
      client.decisions.create({
        model: this.model,
        input: toText(state),
        questions: Object.entries(questions).map(([id, question]) =>
          toDecisionQuestion(id, question),
        ),
        ...(this.options.safetyIdentifier
          ? { safety_identifier: this.options.safetyIdentifier }
          : {}),
      }),
    );
    const { input_tokens: inputTokens, output_tokens: outputTokens } = decision.usage;
    return {
      answers: toAnswers(decision.answers, questions),
      model: decision.model,
      usage: { inputTokens, outputTokens },
      // Decisions bills input tokens only.
      ...(this.usdPerMtokInput === undefined
        ? {}
        : { costUsd: (inputTokens / 1_000_000) * this.usdPerMtokInput }),
      attempts: counter.count,
    };
  }
}

/** Convenience factory: `provider: openaiDecisions()`. */
export function openaiDecisions(options?: OpenAIDecisionsProviderOptions): OpenAIDecisionsProvider {
  return new OpenAIDecisionsProvider(options);
}
