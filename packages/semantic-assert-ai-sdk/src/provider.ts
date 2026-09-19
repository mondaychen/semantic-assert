// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { AnswersFor, JsonValue, Provider, ProviderResult, Questions } from "semantic-assert";

type AiSdk = typeof import("ai", { with: { "resolution-mode": "import" } });
type EvaluationOptions = Parameters<AiSdk["experimental_evaluate"]>[0];
type EvaluationModel = Exclude<EvaluationOptions["model"], string>;
type EvaluationQuestion = EvaluationOptions["questions"][string];

export interface AiSdkProviderOptions extends Pick<
  EvaluationOptions,
  "maxRetries" | "abortSignal" | "headers" | "providerOptions"
> {
  /** Gateway model ID or an SDK evaluation model instance. Defaults to typesafe-ai/jev. */
  model?: EvaluationOptions["model"];
  /** Used for string model IDs. Authentication defaults to AI_GATEWAY_API_KEY. */
  gateway?: Parameters<AiSdk["createGateway"]>[0];
  /** Total evaluation timeout including SDK retries; defaults to 10,000 ms. */
  timeoutMs?: number;
  /** Optional explicit rates. Cost is omitted when rates or token counts are unavailable. */
  pricing?: { inputUsdPerMtok: number; outputUsdPerMtok: number };
}

// The SDK only accepts string/object/array at the top level. Nested JSON is unchanged.
function toInput(value: JsonValue): EvaluationQuestion["instructions"] {
  return value === null || typeof value === "number" || typeof value === "boolean"
    ? JSON.stringify(value)
    : value;
}

/** Vercel AI SDK's typed evaluation API as a semantic-assert provider. */
export class AiSdkProvider implements Provider {
  readonly name = "ai-sdk";
  private modelInstance: EvaluationModel | undefined;
  private readonly timeoutMs: number;

  constructor(private readonly options: AiSdkProviderOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0 || this.timeoutMs > 2 ** 32 - 1) {
      throw new Error("timeoutMs must be a positive integer no greater than 4294967295");
    }
    if (
      options.maxRetries !== undefined &&
      (!Number.isInteger(options.maxRetries) || options.maxRetries < 0)
    ) {
      throw new Error("maxRetries must be a non-negative integer");
    }
    if (options.pricing) {
      for (const rate of [options.pricing.inputUsdPerMtok, options.pricing.outputUsdPerMtok]) {
        if (!Number.isFinite(rate) || rate < 0)
          throw new Error("Pricing rates must be finite non-negative numbers");
      }
    }
  }

  async evaluate<Q extends Questions>(state: JsonValue, questions: Q): Promise<ProviderResult<Q>> {
    // AI SDK is ESM-only. Dynamic import keeps our CommonJS entry usable on Node 22.
    const { createGateway, experimental_evaluate: evaluate } = await import("ai");
    const sdkQuestions: Record<string, EvaluationQuestion> = Object.fromEntries(
      Object.entries(questions).map(([id, question]): [string, EvaluationQuestion] => [
        id,
        question.type === "noul"
          ? { ...question, type: "boolean", instructions: toInput(question.instructions) }
          : { ...question, instructions: toInput(question.instructions) },
      ]),
    );
    const configuredModel = this.options.model ?? "typesafe-ai/jev";
    this.modelInstance ??=
      typeof configuredModel === "string"
        ? createGateway(this.options.gateway).evaluationModel(configuredModel)
        : configuredModel;
    const model = this.modelInstance;
    // Wrap each call locally so concurrent evaluations cannot mix retry counts.
    let attempts = 0;
    const trackedModel: EvaluationModel = {
      specificationVersion: model.specificationVersion,
      provider: model.provider,
      modelId: model.modelId,
      supportedQuestionTypes: model.supportedQuestionTypes,
      doEvaluate: (options) => {
        attempts += 1;
        return model.doEvaluate(options);
      },
    };
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const result = await evaluate({
      model: trackedModel,
      state: toInput(state),
      questions: sdkQuestions,
      maxRetries: this.options.maxRetries,
      abortSignal: this.options.abortSignal
        ? AbortSignal.any([timeout, this.options.abortSignal])
        : timeout,
      headers: this.options.headers,
      providerOptions: this.options.providerOptions,
    });

    // The SDK validates question IDs, answer types, ranges, and distributions.
    const answers = Object.fromEntries(
      Object.entries(result.answers).map(([id, answer]) => {
        if (answer.type === "boolean") return [id, { type: "noul", noul: answer.probability }];
        if (answer.type !== "choice" || !answer.probabilities) {
          throw new Error(
            `AI SDK answer for "${id}" must include a Choice probability distribution`,
          );
        }
        return [
          id,
          {
            type: "choice",
            choice: answer.choice,
            // SDK Choice has no native confidence field. Expose the selected probability.
            confidence: answer.probabilities[answer.choice]!,
            probabilities: answer.probabilities,
          },
        ];
      }),
    ) as AnswersFor<Q>;

    const { inputTokens, outputTokens } = result.usage;
    const hasUsage = inputTokens !== undefined || outputTokens !== undefined;
    const pricing = this.options.pricing;
    const costUsd =
      pricing && inputTokens !== undefined && outputTokens !== undefined
        ? (inputTokens * pricing.inputUsdPerMtok + outputTokens * pricing.outputUsdPerMtok) /
          1_000_000
        : undefined;
    return {
      answers,
      model: result.response.modelId,
      ...(hasUsage
        ? { usage: { inputTokens: inputTokens ?? 0, outputTokens: outputTokens ?? 0 } }
        : {}),
      ...(costUsd !== undefined ? { costUsd } : {}),
      attempts,
    };
  }
}

/** Convenience factory: `provider: aiSdk()`. Uses Jev through AI Gateway by default. */
export function aiSdk(options?: AiSdkProviderOptions): AiSdkProvider {
  return new AiSdkProvider(options);
}
