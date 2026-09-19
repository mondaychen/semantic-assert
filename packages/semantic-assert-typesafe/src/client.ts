// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

/**
 * Compatibility facade over the official TypeSafe SDK. Keeps semantic-assert's
 * retry policy, result validation, and metrics independent of SDK defaults.
 */

import {
  APIConnectionError,
  APIError,
  TypeSafeClient,
  type EntryType,
  type Questions as SdkQuestions,
} from "@typesafe-ai/sdk";
import type { AnswersFor, JsonValue, Question, Questions } from "semantic-assert";

export interface SystemOneResult<Q extends Questions> {
  model: string;
  answers: AnswersFor<Q>;
  usage: { input_tokens: number; output_tokens: number };
}

/** What one `systemOne` call cost, recorded after it settles. */
export interface CallMetrics {
  model: string;
  questionCount: number;
  inputTokens: number;
  outputTokens: number;
  waitMs: number;
  /** 1 when the first attempt succeeded. */
  attempts: number;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface JevClientOptions {
  /** Called after every successful request with its usage and timing. */
  onCall?: (metrics: CallMetrics) => void;
  /** Defaults to `TYPESAFE_API_KEY`. */
  apiKey?: string;
  /** Defaults to `TYPESAFE_BASE_URL`, then https://api.typesafe.ai. */
  baseUrl?: string;
  /** Defaults to `TYPESAFE_DEFAULT_MODEL`, then jev-latest. */
  model?: string;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Retries for 429 / 529 / network failures. */
  maxRetries?: number;
  /** Transport override, mainly for tests. Defaults to the global fetch. */
  fetch?: FetchLike;
  /** Backoff sleeper override, mainly for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export class JevApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`TypeSafe API request failed with HTTP ${status}: ${body.slice(0, 500)}`);
    this.name = "JevApiError";
  }
}

const RETRYABLE_STATUSES = new Set([429, 529]);

// Backoff between retries in a Node HTTP client, not UI timing.
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The SDK accepts structured JSON, but top-level numbers and booleans must be text.
function toEntry(value: JsonValue): EntryType {
  return typeof value === "number" || typeof value === "boolean" ? JSON.stringify(value) : value;
}

export class JevClient {
  private readonly sdk: TypeSafeClient;
  readonly model: string;
  private readonly maxRetries: number;
  private readonly onCall: ((metrics: CallMetrics) => void) | undefined;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: JevClientOptions = {}) {
    this.onCall = options.onCall;
    this.maxRetries = options.maxRetries ?? 3;
    if (!Number.isInteger(this.maxRetries) || this.maxRetries < 0) {
      throw new Error("maxRetries must be a non-negative integer");
    }
    const fetchImpl = options.fetch;
    this.sdk = new TypeSafeClient({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
      defaultModel: options.model,
      timeout: options.timeoutMs ?? 10_000,
      fetch: fetchImpl ? (input, init) => fetchImpl(input, init ?? {}) : undefined,
      // One retry owner preserves the public sleep hook and 429/529-only policy.
      retry: { maxRetries: 0 },
    });
    this.model = this.sdk.defaultModel;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /**
   * Evaluate one `state` against a map of questions. All questions see the same
   * state and are answered in parallel by the model, so batch every question
   * about the same state into a single call.
   */
  async systemOne<Q extends Questions>(
    state: JsonValue,
    questions: Q,
  ): Promise<SystemOneResult<Q>> {
    if (Object.keys(questions).length === 0) {
      throw new Error("systemOne requires at least one question");
    }
    const startedAt = performance.now();
    const sdkQuestions: SdkQuestions = Object.fromEntries(
      Object.entries(questions).map(([id, question]) => [
        id,
        { ...question, instructions: toEntry(question.instructions) },
      ]),
    );

    let attempt = 0;
    for (;;) {
      let payload: unknown;
      try {
        payload = await this.sdk.systemOne({
          model: this.model,
          state: toEntry(state),
          questions: sdkQuestions,
        });
      } catch (error) {
        const retryable =
          error instanceof APIConnectionError ||
          (error instanceof APIError && RETRYABLE_STATUSES.has(error.status));
        if (retryable && attempt < this.maxRetries) {
          attempt += 1;
          await this.sleep(500 * 2 ** attempt);
          continue;
        }
        if (error instanceof APIError) {
          const body =
            typeof error.body === "string" ? error.body : (JSON.stringify(error.body) ?? "");
          throw new JevApiError(error.status, body);
        }
        throw error;
      }

      // A malformed success body is a bug, not a transient failure: no retry.
      const result = this.parseResult(payload, questions);
      this.onCall?.({
        model: result.model,
        questionCount: Object.keys(questions).length,
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        waitMs: performance.now() - startedAt,
        attempts: attempt + 1,
      });
      return result;
    }
  }

  private parseResult<Q extends Questions>(payload: unknown, questions: Q): SystemOneResult<Q> {
    if (!isRecord(payload) || !isRecord(payload.answers) || typeof payload.model !== "string") {
      throw new Error(
        `Unexpected TypeSafe response shape: ${String(JSON.stringify(payload)).slice(0, 500)}`,
      );
    }
    for (const [id, question] of Object.entries(questions) as Array<[string, Question]>) {
      const answer = payload.answers[id];
      if (!isRecord(answer) || answer.type !== question.type) {
        throw new Error(
          `TypeSafe response is missing a ${question.type} answer for question "${id}"`,
        );
      }
    }
    const usage = isRecord(payload.usage) ? payload.usage : {};
    return {
      model: payload.model,
      // Shape validated field-by-field above; the generic mapping is what callers rely on.
      answers: payload.answers as SystemOneResult<Q>["answers"],
      usage: {
        input_tokens: typeof usage.input_tokens === "number" ? usage.input_tokens : 0,
        output_tokens: typeof usage.output_tokens === "number" ? usage.output_tokens : 0,
      },
    };
  }
}
