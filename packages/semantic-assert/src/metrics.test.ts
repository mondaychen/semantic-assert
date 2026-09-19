// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";

import { aggregateUsage, renderUsage, summarizeCalls } from "./metrics";
import { describeUrl, truncateText } from "./url";

const call = (over: Partial<Parameters<typeof summarizeCalls>[0][number]> = {}) => ({
  model: "m",
  questionCount: 1,
  inputTokens: 10,
  outputTokens: 1,
  waitMs: 100,
  attempts: 1,
  ...over,
});

describe("metrics", () => {
  it("summarizes calls including retries, with null cost when none was reported", () => {
    const s = summarizeCalls([
      call({ questionCount: 2, inputTokens: 100, outputTokens: 5, waitMs: 200 }),
      call({ inputTokens: 50, outputTokens: 5, waitMs: 800, attempts: 3 }),
    ]);
    expect(s.totals).toEqual({
      calls: 2,
      questions: 3,
      inputTokens: 150,
      outputTokens: 10,
      waitMs: 1000,
      retries: 2,
      costUsd: null,
    });
  });

  it("sums provider-reported cost, ignoring calls that did not report one", () => {
    const s = summarizeCalls([call({ costUsd: 0.5 }), call(), call({ costUsd: 0.25 })]);
    expect(s.totals.costUsd).toBe(0.75);
  });

  it("aggregates per group and total", () => {
    const row = (group: string, scenario: string, inputTokens: number, costUsd: number | null) => ({
      group,
      scenario,
      status: "passed",
      models: ["m"],
      calls: 1,
      questions: 1,
      inputTokens,
      outputTokens: 0,
      waitMs: 10,
      retries: 0,
      costUsd,
    });
    const summary = aggregateUsage([
      row("A", "a1", 1000, 0.042),
      row("A", "a2", 500, 0.021),
      row("B", "b1", 0, null),
    ]);
    expect(summary.totals).toMatchObject({ scenarios: 3, calls: 3, inputTokens: 1500 });
    expect(summary.totals.costUsd).toBeCloseTo(0.063);
    expect(summary.groups.map((g) => [g.group, g.scenarios, g.costUsd])).toEqual([
      ["A", 2, 0.063],
      ["B", 1, null],
    ]);
    const text = renderUsage(summary, "Feature");
    expect(text).toContain("Feature");
    expect(text).toContain("Total");
    expect(text).toContain("$0.063000");
    expect(text).toContain("n/a");
  });

  it("renders a note when nothing was judged", () => {
    expect(renderUsage(aggregateUsage([]))).toMatch(/no scenario called the model/);
  });
});

describe("url helpers", () => {
  it("describes a URL by parts", () => {
    expect(describeUrl("https://x.test/dashboard/project/p1?sessionId=s&tab=t")).toEqual({
      url: "https://x.test/dashboard/project/p1?sessionId=s&tab=t",
      pathname: "/dashboard/project/p1",
      path_segments: ["dashboard", "project", "p1"],
      query_params: { sessionId: "s", tab: "t" },
    });
  });

  it("truncates with a marker", () => {
    expect(truncateText("abc", 5)).toEqual({ text: "abc", truncated: false });
    const cut = truncateText("abcdefgh", 3);
    expect(cut.truncated).toBe(true);
    expect(cut.text.startsWith("abc\n# [truncated")).toBe(true);
  });
});
