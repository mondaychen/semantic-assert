// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it } from "vitest";

import { defaultTemplates, resolveJudgeSettings } from "./settings";

describe("resolveJudgeSettings", () => {
  afterEach(() => {
    delete process.env.SEMANTIC_ASSERT_THRESHOLD;
    delete process.env.SEMANTIC_ASSERT_TIMEOUT_MS;
  });

  it("uses built-in defaults", () => {
    const s = resolveJudgeSettings();
    expect(s).toMatchObject({
      threshold: 0.7,
      timeoutMs: 15_000,
      pollIntervalMs: 1_000,
      maxStateChars: 40_000,
    });
    expect(s.templates).toEqual(defaultTemplates);
  });

  it("prefers overrides over env over defaults", () => {
    process.env.SEMANTIC_ASSERT_THRESHOLD = "0.6";
    process.env.SEMANTIC_ASSERT_TIMEOUT_MS = "5000";
    expect(resolveJudgeSettings().threshold).toBe(0.6);
    expect(resolveJudgeSettings({ threshold: 0.95 })).toMatchObject({
      threshold: 0.95,
      timeoutMs: 5000,
    });
  });

  it("rejects thresholds outside [0.5, 1]", () => {
    expect(() => resolveJudgeSettings({ threshold: 0.3 })).toThrow(/between 0.5 and 1/);
    process.env.SEMANTIC_ASSERT_THRESHOLD = "1.5";
    expect(() => resolveJudgeSettings()).toThrow(/between 0.5 and 1/);
  });

  it("falls back to defaults on runtimes without a process global", () => {
    process.env.SEMANTIC_ASSERT_THRESHOLD = "0.6";
    const original = globalThis.process;
    try {
      // Simulate an edge runtime: no `process` at all.
      Reflect.deleteProperty(globalThis, "process");
      expect(resolveJudgeSettings().threshold).toBe(0.7);
    } finally {
      globalThis.process = original;
    }
  });

  it("merges partial template overrides", () => {
    const s = resolveJudgeSettings({
      templates: { pageClaim: (c) => ({ type: "noul", instructions: c }) },
    });
    expect(s.templates.pageClaim("x")).toEqual({ type: "noul", instructions: "x" });
    expect(s.templates.urlClaim).toBe(defaultTemplates.urlClaim);
  });
});
