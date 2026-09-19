// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { APICallError, type Experimental_EvaluationModel } from "ai";
import { choice, noul } from "semantic-assert";
import { afterEach, describe, expect, it, vi } from "vitest";

import { aiSdk } from "./provider";

type Model = Exclude<Experimental_EvaluationModel, string>;
type Result = Awaited<ReturnType<Model["doEvaluate"]>>;
type TestModel = Omit<Model, "doEvaluate"> & {
  doEvaluate: (
    this: void,
    options: Parameters<Model["doEvaluate"]>[0],
  ) => ReturnType<Model["doEvaluate"]>;
};

function mockModel(result: Partial<Result> = {}): TestModel {
  return {
    specificationVersion: "v4",
    provider: "test",
    modelId: "test-evaluator",
    supportedQuestionTypes: ["boolean", "choice"],
    doEvaluate: vi.fn(async () => ({
      answers: { a: { type: "boolean" as const, probability: 0.9 } },
      warnings: [],
      ...result,
    })),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("AiSdkProvider", () => {
  it("sends one typed Gateway request and maps Boolean and Choice answers", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        answers: {
          a: { type: "boolean", probability: 0.03 },
          team: {
            type: "choice",
            choice: "billing",
            probabilities: { billing: 0.9, technical: 0.1 },
          },
        },
        usage: { inputTokens: 500_000, outputTokens: 20 },
      }),
    );
    const provider = aiSdk({
      gateway: { baseURL: "https://gateway.example/v4/ai", fetch: fetchMock },
      headers: { "x-test": "example" },
      providerOptions: { gateway: { zeroDataRetention: true } },
      pricing: { inputUsdPerMtok: 0.04, outputUsdPerMtok: 0 },
    });
    const questions = {
      a: noul({ statement: "A refund was denied" }, { true: "Denied", false: "Approved" }),
      team: choice("Which team?", { billing: "Payments", technical: null }),
    };
    const result = await provider.evaluate(
      { message: "Refund approved", metadata: [true, null, 3] },
      questions,
    );
    expect(result).toEqual({
      answers: {
        a: { type: "noul", noul: 0.03 },
        team: {
          type: "choice",
          choice: "billing",
          confidence: 0.9,
          probabilities: { billing: 0.9, technical: 0.1 },
        },
      },
      model: "typesafe-ai/jev",
      usage: { inputTokens: 500_000, outputTokens: 20 },
      costUsd: 0.02,
      attempts: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://gateway.example/v4/ai/evaluation-model");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-key");
    expect(headers.get("ai-model-id")).toBe("typesafe-ai/jev");
    expect(headers.get("x-test")).toBe("example");
    if (typeof init?.body !== "string") throw new Error("Expected a JSON request body");
    expect(JSON.parse(init.body)).toEqual({
      state: { message: "Refund approved", metadata: [true, null, 3] },
      questions: { a: { ...questions.a, type: "boolean" }, team: questions.team },
      providerOptions: { gateway: { zeroDataRetention: true } },
    });
  });

  it.each([null, true, 42])("serializes scalar state and instructions: %s", async (value) => {
    const model = mockModel();
    await aiSdk({ model }).evaluate(value, { a: noul(value) });
    expect(model.doEvaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        state: JSON.stringify(value),
        questions: { a: { type: "boolean", instructions: JSON.stringify(value) } },
      }),
    );
  });

  it("preserves a custom model's resolved model ID and omits unavailable metrics", async () => {
    const result = await aiSdk({
      model: mockModel({ response: { modelId: "resolved-version" } }),
    }).evaluate("s", { a: noul("q") });
    expect(result.model).toBe("resolved-version");
    expect(result.usage).toBeUndefined();
    expect(result.costUsd).toBeUndefined();
  });

  it("keeps cost unknown without explicit pricing or complete token usage", async () => {
    const model = mockModel({ usage: { inputTokens: 10 } });
    const result = await aiSdk({
      model,
      pricing: { inputUsdPerMtok: 1, outputUsdPerMtok: 2 },
    }).evaluate("s", { a: noul("q") });
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 0 });
    expect(result.costUsd).toBeUndefined();
    const unpriced = await aiSdk({
      model: mockModel({ usage: { inputTokens: 10, outputTokens: 2 } }),
    }).evaluate("s", { a: noul("q") });
    expect(unpriced.costUsd).toBeUndefined();
  });

  it("requires a Choice distribution instead of inventing certainty", async () => {
    const model = mockModel({ answers: { a: { type: "choice", choice: "yes" } } });
    await expect(
      aiSdk({ model }).evaluate("s", { a: choice("q", { yes: "Yes", no: "No" }) }),
    ).rejects.toThrow(/probability distribution/);
  });

  it.each<Result["answers"]>([
    {},
    { a: { type: "boolean", probability: 1.1 } },
    { a: { type: "choice", choice: "yes" } },
  ])("rejects malformed answers without retrying", async (answers) => {
    const model = mockModel({ answers });
    await expect(aiSdk({ model }).evaluate("s", { a: noul("q") })).rejects.toThrow();
    expect(model.doEvaluate).toHaveBeenCalledTimes(1);
  });

  it("rejects an incomplete Choice distribution", async () => {
    const model = mockModel({
      answers: { a: { type: "choice", choice: "yes", probabilities: { yes: 1 } } },
    });
    await expect(
      aiSdk({ model }).evaluate("s", { a: choice("q", { yes: "Yes", no: "No" }) }),
    ).rejects.toThrow(/complete distribution/);
  });

  it("rejects empty questions before calling the model", async () => {
    const model = mockModel();
    await expect(aiSdk({ model }).evaluate("s", {})).rejects.toThrow(/nonempty/);
    expect(model.doEvaluate).not.toHaveBeenCalled();
  });

  it("preserves SDK retries and counts attempts separately for concurrent calls", async () => {
    vi.useFakeTimers();
    const model = mockModel();
    let retryAttempts = 0;
    model.doEvaluate = vi.fn<Model["doEvaluate"]>(async ({ state }) => {
      if (state === "retry" && retryAttempts++ === 0) {
        throw new APICallError({
          message: "Busy",
          url: "https://example.test",
          requestBodyValues: {},
          statusCode: 429,
          isRetryable: true,
        });
      }
      return { answers: { a: { type: "boolean", probability: 0.9 } }, warnings: [] };
    });
    const provider = aiSdk({ model, maxRetries: 1 });
    const pending = Promise.all([
      provider.evaluate("retry", { a: noul("q") }),
      provider.evaluate("success", { a: noul("q") }),
    ]);
    await vi.advanceTimersByTimeAsync(3_000);
    expect((await pending).map((r) => r.attempts)).toEqual([2, 1]);
  });

  it("does not retry an account-verification failure", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json(
        {
          error: {
            message: "Account verification required",
            type: "customer_verification_required",
          },
        },
        { status: 403 },
      ),
    );
    const provider = aiSdk({ gateway: { apiKey: "test", fetch: fetchMock } });
    await expect(provider.evaluate("s", { a: noul("q") })).rejects.toThrow(/verification required/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes cancellation through without calling the model", async () => {
    const model = mockModel();
    const abortSignal = AbortSignal.abort(new Error("Cancelled"));
    await expect(aiSdk({ model, abortSignal }).evaluate("s", { a: noul("q") })).rejects.toThrow(
      "Cancelled",
    );
    expect(model.doEvaluate).not.toHaveBeenCalled();
  });

  it("bounds evaluations with a timeout signal", async () => {
    const model = mockModel();
    model.doEvaluate = ({ abortSignal }) =>
      new Promise((_, reject) => {
        abortSignal!.addEventListener("abort", () => reject(abortSignal!.reason), { once: true });
      });
    await expect(
      aiSdk({ model, timeoutMs: 20, maxRetries: 0 }).evaluate("s", { a: noul("q") }),
    ).rejects.toThrow(/timeout/i);
  });

  it("constructs without credentials and validates numeric options", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    expect(() => aiSdk()).not.toThrow();
    expect(() => aiSdk({ timeoutMs: 0 })).toThrow(/timeoutMs/);
    expect(() => aiSdk({ maxRetries: -1 })).toThrow(/maxRetries/);
    expect(() => aiSdk({ pricing: { inputUsdPerMtok: NaN, outputUsdPerMtok: 0 } })).toThrow(
      /Pricing/,
    );
  });
});
