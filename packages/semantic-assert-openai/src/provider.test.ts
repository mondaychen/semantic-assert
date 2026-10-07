// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { APIError } from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { choice, noul } from "semantic-assert";
import { DecisionRefusalError, type FetchLike, OpenAIDecisionsProvider } from "./provider";

function response(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const usage = {
  input_tokens: 500_000,
  input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
  output_tokens: 0,
  output_tokens_details: { reasoning_tokens: 0 },
  total_tokens: 500_000,
};

const okBody = {
  model: "gpt-6-luna",
  answers: [
    { type: "predicate", name: "a", probability: 0.9 },
    {
      type: "choice",
      name: "b",
      choice: "x",
      confidence: 0.75,
      probabilities: [
        { value: "x", probability: 0.8 },
        { value: "y", probability: 0.2 },
      ],
    },
  ],
  usage,
};

const questions = {
  a: noul({ statement: "saved" }, { true: "It says saved.", false: "It does not." }),
  b: choice("pick", { x: null, y: "the other one" }),
};

function requestBody(fetchMock: ReturnType<typeof vi.fn<FetchLike>>, index = 0): unknown {
  return JSON.parse(fetchMock.mock.calls[index]![1]!.body as string);
}

describe("OpenAIDecisionsProvider", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("posts state and questions to /v1/decisions and maps the answers", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(response(200, okBody));
    const provider = new OpenAIDecisionsProvider({
      apiKey: "k",
      fetch: fetchMock,
      usdPerMtokInput: 0.1,
    });

    const result = await provider.evaluate({ doc: "hi" }, questions);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/decisions");
    expect(new Headers(init!.headers).get("authorization")).toBe("Bearer k");
    expect(requestBody(fetchMock)).toEqual({
      model: "gpt-6-luna",
      input: '{"doc":"hi"}',
      questions: [
        {
          name: "a",
          type: "predicate",
          instructions: JSON.stringify({
            statement: "saved",
            true_when: "It says saved.",
            false_when: "It does not.",
          }),
        },
        {
          name: "b",
          type: "choice",
          instructions: "pick",
          choices: [{ value: "x" }, { value: "y", description: "the other one" }],
        },
      ],
    });
    expect(result).toEqual({
      answers: {
        a: { type: "noul", noul: 0.9 },
        b: { type: "choice", choice: "x", confidence: 0.75, probabilities: { x: 0.8, y: 0.2 } },
      },
      model: "gpt-6-luna",
      usage: { inputTokens: 500_000, outputTokens: 0 },
      costUsd: 0.05,
      attempts: 1,
    });
  });

  it("passes string state through and forwards model and safety identifier", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      response(200, {
        model: "gpt-6-luna-2026-10-01",
        answers: [{ type: "predicate", name: "a", probability: 0.1 }],
        usage,
      }),
    );
    const provider = new OpenAIDecisionsProvider({
      apiKey: "k",
      fetch: fetchMock,
      model: "gpt-6-luna-2026-10-01",
      safetyIdentifier: "user-123",
    });
    const result = await provider.evaluate("Saved", { a: noul("Saved?") });
    expect(requestBody(fetchMock)).toMatchObject({
      model: "gpt-6-luna-2026-10-01",
      input: "Saved",
      questions: [{ name: "a", type: "predicate", instructions: "Saved?" }],
      safety_identifier: "user-123",
    });
    expect(result.model).toBe("gpt-6-luna-2026-10-01");
  });

  it("wraps non-object instructions when adding criteria", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      response(200, {
        model: "gpt-6-luna",
        answers: [{ type: "predicate", name: "a", probability: 0.5 }],
        usage,
      }),
    );
    const provider = new OpenAIDecisionsProvider({ apiKey: "k", fetch: fetchMock });
    await provider.evaluate("s", { a: noul("Saved?", { true: "Yes." }) });
    expect(requestBody(fetchMock)).toMatchObject({
      questions: [{ instructions: '{"instructions":"Saved?","true_when":"Yes."}' }],
    });
  });

  it("defers API-key validation until the first evaluation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const provider = new OpenAIDecisionsProvider();
    await expect(provider.evaluate("s", { a: noul("q") })).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("reports cost as unknown unless a rate is configured", async () => {
    const fetchMock = vi.fn<FetchLike>().mockImplementation(async () => response(200, okBody));
    const unpriced = await new OpenAIDecisionsProvider({ apiKey: "k", fetch: fetchMock }).evaluate(
      "s",
      questions,
    );
    expect(unpriced.costUsd).toBeUndefined();

    vi.stubEnv("OPENAI_DECISIONS_USD_PER_MTOK_INPUT", "0.2");
    const priced = await new OpenAIDecisionsProvider({ apiKey: "k", fetch: fetchMock }).evaluate(
      "s",
      questions,
    );
    expect(priced.costUsd).toBeCloseTo(0.1);
    expect(() => new OpenAIDecisionsProvider({ usdPerMtokInput: -1 })).toThrow(/usdPerMtokInput/);
  });

  it("raises a refusal instead of guessing an answer", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      response(200, {
        model: "gpt-6-luna",
        answers: [okBody.answers[0], { type: "refusal", name: "b" }],
        usage,
      }),
    );
    const provider = new OpenAIDecisionsProvider({ apiKey: "k", fetch: fetchMock });
    const error = await provider.evaluate("s", questions).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DecisionRefusalError);
    expect((error as DecisionRefusalError).questions).toEqual(["b"]);
  });

  it("rejects a missing, mistyped, or unknown answer", async () => {
    for (const answers of [
      [okBody.answers[0]],
      [okBody.answers[0], { type: "predicate", name: "b", probability: 0.5 }],
      [okBody.answers[0], { ...okBody.answers[1], choice: "z" }],
    ]) {
      const fetchMock = vi
        .fn<FetchLike>()
        .mockResolvedValue(response(200, { model: "gpt-6-luna", answers, usage }));
      const provider = new OpenAIDecisionsProvider({ apiKey: "k", fetch: fetchMock });
      await expect(provider.evaluate("s", questions)).rejects.toThrow(
        /missing a choice answer for "b"/,
      );
    }
  });

  it("counts retried attempts per call, even when calls overlap", async () => {
    const ok = response(200, {
      model: "gpt-6-luna",
      answers: [{ type: "predicate", name: "a", probability: 0.9 }],
      usage,
    });
    let limited = false;
    const fetchMock = vi.fn<FetchLike>().mockImplementation(async (_url, init) => {
      const { input } = JSON.parse(init!.body as string) as { input: string };
      if (input === "retry" && !limited) {
        limited = true;
        return response(429, { error: { message: "slow down" } }, { "retry-after-ms": "0" });
      }
      return ok.clone();
    });
    const provider = new OpenAIDecisionsProvider({ apiKey: "k", fetch: fetchMock });
    const [retried, direct] = await Promise.all([
      provider.evaluate("retry", { a: noul("q") }),
      provider.evaluate("direct", { a: noul("q") }),
    ]);
    expect(retried.attempts).toBe(2);
    expect(direct.attempts).toBe(1);
  });

  it("surfaces API errors once retries are exhausted", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockImplementation(async () =>
        response(
          429,
          { error: { message: "slow down" } },
          { "retry-after-ms": "0", "x-should-retry": "true" },
        ),
      );
    const provider = new OpenAIDecisionsProvider({ apiKey: "k", fetch: fetchMock, maxRetries: 1 });
    await expect(provider.evaluate("s", { a: noul("q") })).rejects.toMatchObject({
      status: 429,
    });
    await expect(provider.evaluate("s", { a: noul("q") })).rejects.toBeInstanceOf(APIError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not retry a 403 for an organization without access", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValue(
        response(403, { error: { message: "Decision API is not enabled for this user" } }),
      );
    const provider = new OpenAIDecisionsProvider({ apiKey: "k", fetch: fetchMock });
    await expect(provider.evaluate("s", { a: noul("q") })).rejects.toThrow(/not enabled/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("validates options and questions", async () => {
    expect(() => new OpenAIDecisionsProvider({ timeoutMs: 0 })).toThrow(/timeoutMs/);
    expect(() => new OpenAIDecisionsProvider({ maxRetries: -1 })).toThrow(/maxRetries/);
    await expect(new OpenAIDecisionsProvider({ apiKey: "k" }).evaluate("s", {})).rejects.toThrow(
      /at least one question/,
    );
  });
});
