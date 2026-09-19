// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { noul } from "semantic-assert";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FetchLike } from "./client";
import { TypeSafeProvider, typesafe } from "./provider";

describe("TypeSafeProvider", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defers SDK API-key validation until the first evaluation", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const provider = typesafe();
    await expect(provider.evaluate("s", { a: noul("q") })).rejects.toThrow(/TYPESAFE_API_KEY/);
  });

  it("maps the API result to a ProviderResult with input-token cost", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "jev-1.13.0",
          answers: { a: { type: "noul", noul: 0.9 } },
          usage: { input_tokens: 500_000, output_tokens: 7 },
        }),
        { status: 200 },
      ),
    );
    const provider = new TypeSafeProvider({
      apiKey: "k",
      fetch: fetchMock,
      usdPerMtokInput: 0.042,
    });
    const result = await provider.evaluate("s", { a: noul("q") });
    expect(result).toEqual({
      answers: { a: { type: "noul", noul: 0.9 } },
      model: "jev-1.13.0",
      usage: { inputTokens: 500_000, outputTokens: 7 },
      costUsd: 0.021,
      attempts: 1,
    });
  });
});
