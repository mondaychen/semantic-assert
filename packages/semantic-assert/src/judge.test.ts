// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";

import { FakeProvider, type Script } from "./fake-provider";
import { Judge, NotReadyError, SemanticAssertionError } from "./judge";
import { resolveJudgeSettings } from "./settings";

function makeJudge(scripts: Script[], timing = { timeoutMs: 3000, pollIntervalMs: 1000 }) {
  const wait = vi.fn(async () => {});
  const attach = vi.fn(async () => {});
  const provider = new FakeProvider({ scripts });
  const judge = new Judge({
    provider,
    settings: resolveJudgeSettings({ threshold: 0.7, ...timing }),
    hooks: { wait, attach },
  });
  return { judge, wait, attach, provider, calls: () => provider.requests.length };
}

/** A judge whose waits advance fake timers, so deadlines expire without real delay. */
function makeTimedJudge(scripts: Script[]) {
  const attach = vi.fn(async () => {});
  const judge = new Judge({
    provider: new FakeProvider({ scripts }),
    settings: resolveJudgeSettings({ timeoutMs: 2500, pollIntervalMs: 1000 }),
    hooks: {
      wait: async (ms) => {
        vi.advanceTimersByTime(ms);
      },
      attach,
    },
  });
  return { judge, attach };
}

describe("Judge.expectClaims", () => {
  it("passes when every claim clears its threshold, using per-claim overrides", async () => {
    const { judge, attach } = makeJudge([{ claim_0: 0.96, claim_1: 0.75 }]);
    const results = await judge.expectClaims(
      async () => ({ a: 1 }),
      [{ claim: "strict", threshold: 0.95 }, { claim: "default" }],
    );
    expect(results.map((r) => [r.threshold, r.passed])).toEqual([
      [0.95, true],
      [0.7, true],
    ]);
    expect(attach).toHaveBeenCalledWith("semantic-answers", expect.objectContaining({ polls: 1 }));
  });

  it("sends every claim to the provider in one request with the captured state", async () => {
    const { judge, provider } = makeJudge([{ claim_0: 0.9, claim_1: 0.9 }]);
    await judge.expectClaims(async () => ({ page: "snapshot" }), [{ claim: "a" }, { claim: "b" }]);
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]!.state).toEqual({ page: "snapshot" });
    expect(Object.keys(provider.requests[0]!.questions)).toEqual(["claim_0", "claim_1"]);
  });

  it("negated claims pass at or below 1 - threshold", async () => {
    const { judge } = makeJudge([{ claim_0: 0.2 }]);
    const [r] = await judge.expectClaims(async () => "s", [{ claim: "absent", expected: false }]);
    expect(r!.passed).toBe(true);
  });

  it("polls until the claim passes", async () => {
    const { judge, wait, calls } = makeJudge([
      { claim_0: 0.1 },
      { claim_0: 0.1 },
      { claim_0: 0.9 },
    ]);
    await judge.expectClaims(async () => "s", [{ claim: "eventually" }]);
    expect(calls()).toBe(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("fails with per-claim detail and attaches the judged state after the deadline", async () => {
    vi.useFakeTimers();
    try {
      const { judge, attach } = makeTimedJudge([{ claim_0: 0.1 }]);
      const error = await judge
        .expectClaims(async () => ({ page: "x" }), [{ claim: "never" }])
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SemanticAssertionError);
      expect((error as Error).message).toMatch(/FAIL {2}p\(yes\)=0\.10 {2}threshold 0\.7/);
      expect(attach).toHaveBeenCalledWith("semantic-state", { page: "x" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a capture that is not ready yet", async () => {
    const { judge, wait, calls } = makeJudge([{ claim_0: 0.9 }]);
    let attempts = 0;
    const capture = async () => {
      attempts += 1;
      if (attempts < 3) throw new NotReadyError("region missing");
      return "ready";
    };
    await judge.expectClaims(capture, [{ claim: "c" }]);
    expect(attempts).toBe(3);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(calls()).toBe(1);
  });

  it("validates thresholds up front", async () => {
    const { judge } = makeJudge([{}]);
    await expect(
      judge.expectClaims(async () => "s", [{ claim: "c", threshold: 0.2 }]),
    ).rejects.toThrow(/between 0.5 and 1/);
    await expect(
      judge.expectClaims(async () => "s", [{ claim: "c" }], { threshold: 1.2 }),
    ).rejects.toThrow(/between 0.5 and 1/);
  });
});

describe("Judge.classify", () => {
  it("keeps polling while the choice is not settled", async () => {
    const { judge, attach, calls } = makeJudge([
      { classification: { choice: "loading" } },
      { classification: { choice: "other" } },
      { classification: { choice: "listed" } },
    ]);
    const answer = await judge.classify(
      async () => "s",
      "state?",
      { listed: "", empty: "", loading: "", other: "" },
      {
        settled: ["listed", "empty"],
      },
    );
    expect(answer.choice).toBe("listed");
    expect(calls()).toBe(3);
    expect(attach).toHaveBeenCalledWith(
      "semantic-classification",
      expect.objectContaining({ settled: true, polls: 3 }),
    );
  });

  it("returns the last answer with its state when it never settles", async () => {
    vi.useFakeTimers();
    try {
      const { judge, attach } = makeTimedJudge([{ classification: { choice: "error" } }]);
      const answer = await judge.classify(
        async () => "stuck",
        "state?",
        { listed: "", error: "" },
        { settled: ["listed"] },
      );
      expect(answer.choice).toBe("error");
      expect(attach).toHaveBeenCalledWith(
        "semantic-classification",
        expect.objectContaining({ settled: false, state: "stuck" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Judge.metrics", () => {
  it("accumulates usage and provider-reported cost across calls", async () => {
    const provider = new FakeProvider({ scripts: [{ claim_0: 0.9 }], costUsd: 0.001 });
    const judge = new Judge({
      provider,
      settings: resolveJudgeSettings(),
      hooks: { wait: async () => {} },
    });
    await judge.expectClaims(async () => "s", [{ claim: "a" }]);
    await judge.evaluate("s", { q: { type: "noul", instructions: "x" } });
    expect(judge.metrics.totals).toMatchObject({
      calls: 2,
      questions: 2,
      inputTokens: 20,
      outputTokens: 2,
      retries: 0,
    });
    expect(judge.metrics.totals.costUsd).toBeCloseTo(0.002);
  });
});
