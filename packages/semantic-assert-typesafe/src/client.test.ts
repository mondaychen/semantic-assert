// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { APIConnectionError, APITimeoutError } from "@typesafe-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { choice, noul } from "semantic-assert";
import { type FetchLike, JevApiError, JevClient } from "./client";

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const okBody = {
  model: "jev-1.13.0",
  answers: {
    a: { type: "noul", noul: 0.9 },
    b: { type: "choice", choice: "x", confidence: 1, probabilities: { x: 1, y: 0 } },
  },
  usage: { input_tokens: 100, output_tokens: 10 },
};

describe("JevClient", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("posts state and questions with the bearer key and reports metrics", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(response(200, okBody));
    const calls: unknown[] = [];
    const client = new JevClient({
      apiKey: "k",
      fetch: fetchMock,
      onCall: (m) => calls.push(m),
      sleep: async () => {},
    });

    const result = await client.systemOne(
      { doc: "hi" },
      { a: noul("q?"), b: choice("pick", { x: null, y: null }) },
    );

    expect(result.answers.a.noul).toBe(0.9);
    expect(result.answers.b.choice).toBe("x");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect((init.headers as Record<string, string>)["X-TypeSafe-SDK"]).toMatch(/^typesafe-sdk\//);
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "jev-latest",
      state: { doc: "hi" },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      model: "jev-1.13.0",
      questionCount: 2,
      inputTokens: 100,
      outputTokens: 10,
      attempts: 1,
    });
  });

  it("retries 429 and 529 with backoff, then succeeds", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(response(429, { error: "slow down" }))
      .mockResolvedValueOnce(response(529, { error: "overloaded" }))
      .mockResolvedValueOnce(response(200, okBody));
    const sleep = vi.fn(async () => {});
    const metrics: unknown[] = [];
    const tracked = new JevClient({
      apiKey: "k",
      fetch: fetchMock,
      sleep,
      onCall: (m) => metrics.push(m),
    });

    const result = await tracked.systemOne("s", { a: noul("q") });
    expect(result.model).toBe("jev-1.13.0");
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls).toEqual([[1000], [2000]]);
    expect(metrics[0]).toMatchObject({ attempts: 3 });
  });

  it("does not retry 422 and surfaces the body", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValue(response(422, { detail: "bad criteria" }));
    const client = new JevClient({ apiKey: "k", fetch: fetchMock, sleep: async () => {} });
    await expect(client.systemOne("s", { a: noul("q") })).rejects.toBeInstanceOf(JevApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a response missing an answer without retrying", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValue(response(200, { model: "m", answers: {}, usage: {} }));
    const sleep = vi.fn(async () => {});
    const client = new JevClient({ apiKey: "k", fetch: fetchMock, sleep });
    await expect(client.systemOne("s", { a: noul("q") })).rejects.toThrow(
      /missing a noul answer for question "a"/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a network failure", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(response(200, okBody));
    const client = new JevClient({ apiKey: "k", fetch: fetchMock, sleep: async () => {} });
    await expect(client.systemOne("s", { a: noul("q") })).resolves.toMatchObject({
      model: "jev-1.13.0",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("requires an API key", () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    expect(() => new JevClient()).toThrow(/TYPESAFE_API_KEY/);
  });

  it("preserves environment defaults and explicit option precedence", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", " env-key ");
    vi.stubEnv("TYPESAFE_BASE_URL", " https://env.example/// ");
    vi.stubEnv("TYPESAFE_DEFAULT_MODEL", " env-model ");
    const fetchMock = vi.fn<FetchLike>().mockImplementation(async () => response(200, okBody));
    await new JevClient({ fetch: fetchMock }).systemOne("s", { a: noul("q") });
    await new JevClient({
      apiKey: "explicit-key",
      baseUrl: "https://explicit.example/",
      model: "explicit-model",
      fetch: fetchMock,
    }).systemOne("s", { a: noul("q") });
    for (const [index, source] of ["env", "explicit"].entries()) {
      const [url, init] = fetchMock.mock.calls[index]!;
      expect(url).toBe(`https://${source}.example/v1/systemone`);
      expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${source}-key`);
      expect(JSON.parse(init.body as string).model).toBe(`${source}-model`);
    }
  });

  it.each([429, 529])(
    "bounds retries for HTTP %s without SDK retry multiplication",
    async (status) => {
      const fetchMock = vi
        .fn<FetchLike>()
        .mockImplementation(async () => response(status, { detail: "try later" }));
      const sleep = vi.fn(async () => {});
      const onCall = vi.fn();
      const client = new JevClient({ apiKey: "k", fetch: fetchMock, sleep, onCall, maxRetries: 1 });
      await expect(client.systemOne("s", { a: noul("q") })).rejects.toMatchObject({
        name: "JevApiError",
        status,
        body: JSON.stringify({ detail: "try later" }),
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledExactlyOnceWith(1000);
      expect(onCall).not.toHaveBeenCalled();
    },
  );

  it("does not adopt the SDK's broader HTTP 500 retry policy", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(response(500, { error: "failed" }));
    const client = new JevClient({ apiKey: "k", fetch: fetchMock, sleep: async () => {} });
    await expect(client.systemOne("s", { a: noul("q") })).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("supports zero retries for connection errors", async () => {
    const fetchMock = vi.fn<FetchLike>().mockRejectedValue(new TypeError("offline"));
    const client = new JevClient({ apiKey: "k", fetch: fetchMock, maxRetries: 0 });
    await expect(client.systemOne("s", { a: noul("q") })).rejects.toBeInstanceOf(
      APIConnectionError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("times out stalled response bodies and bounds retries", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockImplementation(async () => new Response(new ReadableStream()));
    const sleep = vi.fn(async () => {});
    const client = new JevClient({
      apiKey: "k",
      fetch: fetchMock,
      timeoutMs: 10,
      maxRetries: 1,
      sleep,
    });
    await expect(client.systemOne("s", { a: noul("q") })).rejects.toBeInstanceOf(APITimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(1000);
  });

  it.each(["invalid JSON", ""])("does not retry malformed successful body %j", async (body) => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(new Response(body));
    const sleep = vi.fn(async () => {});
    const client = new JevClient({ apiKey: "k", fetch: fetchMock, sleep });
    await expect(client.systemOne("s", { a: noul("q") })).rejects.toThrow(
      /Unexpected TypeSafe response shape/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("adapts primitive JSON entries without changing nested JSON or criteria", async () => {
    const fetchMock = vi.fn<FetchLike>().mockImplementation(async () => response(200, okBody));
    const client = new JevClient({ apiKey: "k", fetch: fetchMock });
    await client.systemOne(42, {
      a: noul(true),
      b: choice({ nested: [false, 3] }, { x: null, y: "other" }),
    });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({
      state: "42",
      questions: {
        a: { instructions: "true" },
        b: { instructions: { nested: [false, 3] }, criteria: { x: null, y: "other" } },
      },
    });
  });
});
