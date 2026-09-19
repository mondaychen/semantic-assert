// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { JsonValue, Provider, ProviderResult, Questions } from "semantic-assert";

import { JevClient, type JevClientOptions } from "./client";

/**
 * USD per million input tokens. Jev 1.13 is $0.042/Mtok with free output
 * tokens (docs.typesafe.ai/models, read 2026-09-17). Override with the
 * `usdPerMtokInput` option or TYPESAFE_USD_PER_MTOK_INPUT.
 */
export const DEFAULT_USD_PER_MTOK_INPUT = 0.042;

export interface TypeSafeProviderOptions extends Omit<JevClientOptions, "onCall"> {
  /** Input-token price used for the per-call cost. */
  usdPerMtokInput?: number;
}

function readPrice(override?: number): number {
  if (override !== undefined) return override;
  const raw = process.env.TYPESAFE_USD_PER_MTOK_INPUT?.trim();
  if (!raw) return DEFAULT_USD_PER_MTOK_INPUT;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`TYPESAFE_USD_PER_MTOK_INPUT must be a non-negative number, got "${raw}"`);
  }
  return value;
}

/** TypeSafe System One (Jev) as a semantic-assert provider. */
export class TypeSafeProvider implements Provider {
  readonly name = "typesafe";
  private readonly clientOptions: Omit<JevClientOptions, "onCall">;
  private readonly usdPerMtokInput: number;
  private clientInstance: JevClient | undefined;

  constructor(options: TypeSafeProviderOptions = {}) {
    const { usdPerMtokInput, ...clientOptions } = options;
    this.usdPerMtokInput = readPrice(usdPerMtokInput);
    this.clientOptions = clientOptions;
  }

  /**
   * Created on first use so that `typesafe()` can be called at module load
   * (e.g. in a Playwright fixtures file) before the API key is validated.
   */
  get client(): JevClient {
    this.clientInstance ??= new JevClient(this.clientOptions);
    return this.clientInstance;
  }

  async evaluate<Q extends Questions>(state: JsonValue, questions: Q): Promise<ProviderResult<Q>> {
    const result = await this.client.systemOne(state, questions);
    return {
      answers: result.answers,
      model: result.model,
      usage: { inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens },
      // Jev bills input tokens only.
      costUsd: (result.usage.input_tokens / 1_000_000) * this.usdPerMtokInput,
      attempts: result.attempts,
    };
  }
}

/** Convenience factory: `provider: typesafe()`. */
export function typesafe(options?: TypeSafeProviderOptions): TypeSafeProvider {
  return new TypeSafeProvider(options);
}
