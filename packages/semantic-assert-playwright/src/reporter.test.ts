// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { FullConfig, TestCase, TestResult } from "@playwright/test/reporter";
import { type CallMetrics, summarizeCalls } from "semantic-assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import UsageReporter from "./reporter";

function testCase(feature: string, title: string): TestCase {
  return {
    id: `${feature}/${title}`,
    title,
    parent: { title: feature },
    location: { file: "/x/f.spec.js" },
  } as unknown as TestCase;
}

/** A result carrying one metrics attachment per argument, as the fixture and matchers write them. */
function result(status: string, ...perAttachment: CallMetrics[][]): TestResult {
  return {
    status,
    attachments: perAttachment.map((calls) => ({
      name: "semantic-assert-metrics",
      contentType: "application/json",
      body: Buffer.from(JSON.stringify(summarizeCalls(calls))),
    })),
  } as unknown as TestResult;
}

const call: CallMetrics = {
  model: "m",
  questionCount: 2,
  inputTokens: 1_000_000,
  outputTokens: 3,
  waitMs: 400,
  attempts: 1,
  costUsd: 1,
};

function runReporter(register: (reporter: UsageReporter) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "semantic-assert-reporter-"));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const reporter = new UsageReporter({ outputFile: "out/metrics.json" });
  reporter.onBegin({
    configFile: path.join(dir, "pw.config.ts"),
    rootDir: path.join(dir, "e2e"),
  } as FullConfig);
  register(reporter);
  reporter.onEnd();
  const written = JSON.parse(fs.readFileSync(path.join(dir, "out/metrics.json"), "utf8"));
  const printed = log.mock.calls.map((c) => String(c[0])).join("\n");
  log.mockRestore();
  return { written, printed };
}

describe("UsageReporter", () => {
  it("aggregates attachments per feature and writes JSON next to the config", () => {
    const { written, printed } = runReporter((reporter) => {
      reporter.onTestEnd(testCase("F1", "s1"), result("passed", [call]));
      reporter.onTestEnd(testCase("F1", "s2"), result("failed", [call]));
      reporter.onTestEnd(testCase("F2", "skipped"), result("skipped"));
    });
    expect(written.totals).toMatchObject({
      scenarios: 2,
      calls: 2,
      inputTokens: 2_000_000,
      costUsd: 2,
    });
    expect(written.groups).toHaveLength(1);
    expect(printed).toContain("Total");
  });

  it("merges several metrics attachments on one test, as matcher calls produce", () => {
    const { written } = runReporter((reporter) => {
      reporter.onTestEnd(testCase("F", "matchers"), result("passed", [call], [call], [call]));
    });
    expect(written.totals).toMatchObject({
      scenarios: 1,
      calls: 3,
      questions: 6,
      inputTokens: 3_000_000,
      costUsd: 3,
    });
  });

  it("merges retries of one test into a single row with the final status", () => {
    const flaky = testCase("F", "flaky");
    const { written } = runReporter((reporter) => {
      reporter.onTestEnd(flaky, result("failed", [call]));
      reporter.onTestEnd(flaky, result("passed", [call, call]));
    });
    expect(written.scenarios).toHaveLength(1);
    expect(written.scenarios[0]).toMatchObject({ scenario: "flaky", status: "passed", calls: 3 });
    expect(written.totals).toMatchObject({ scenarios: 1, calls: 3, costUsd: 3 });
  });
});
