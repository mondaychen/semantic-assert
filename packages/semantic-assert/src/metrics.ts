// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

/** What one provider call cost, recorded by the Judge after it settles. */
export interface CallMetrics {
  /** Versioned model id from the provider, e.g. jev-1.13.0. */
  model: string;
  questionCount: number;
  inputTokens: number;
  outputTokens: number;
  /** Wall-clock time the test spent waiting on the provider. */
  waitMs: number;
  /** Attempts the provider reported; 1 when it did not retry. */
  attempts: number;
  /** Cost estimated by the provider from configured rates; undefined when unknown. */
  costUsd?: number;
}

/** Per-scenario usage: the calls and their totals. */
export interface ScenarioMetrics {
  calls: CallMetrics[];
  totals: UsageTotals;
}

export interface UsageTotals {
  calls: number;
  questions: number;
  inputTokens: number;
  outputTokens: number;
  waitMs: number;
  retries: number;
  /** Sum of provider cost estimates; null when no call reported one. */
  costUsd: number | null;
}

/** Attachment name reporters look for on each test result. */
export const METRICS_ATTACHMENT = "semantic-assert-metrics";

function sumCost(items: ReadonlyArray<{ costUsd?: number | null }>): number | null {
  const known = items.map((i) => i.costUsd).filter((c): c is number => typeof c === "number");
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

export function summarizeCalls(calls: readonly CallMetrics[]): ScenarioMetrics {
  return {
    calls: [...calls],
    totals: {
      calls: calls.length,
      questions: calls.reduce((s, c) => s + c.questionCount, 0),
      inputTokens: calls.reduce((s, c) => s + c.inputTokens, 0),
      outputTokens: calls.reduce((s, c) => s + c.outputTokens, 0),
      waitMs: calls.reduce((s, c) => s + c.waitMs, 0),
      retries: calls.reduce((s, c) => s + (c.attempts - 1), 0),
      costUsd: sumCost(calls),
    },
  };
}

/** One scenario's usage as a reporter sees it. */
export interface ScenarioUsage extends UsageTotals {
  group: string;
  scenario: string;
  status: string;
  models: string[];
}

export interface UsageBucket extends UsageTotals {
  scenarios: number;
}

export interface UsageSummary {
  generatedAt: string;
  models: string[];
  totals: UsageBucket;
  groups: Array<UsageBucket & { group: string }>;
  scenarios: ScenarioUsage[];
}

function emptyBucket(): UsageBucket {
  return {
    scenarios: 0,
    calls: 0,
    questions: 0,
    inputTokens: 0,
    outputTokens: 0,
    waitMs: 0,
    retries: 0,
    costUsd: null,
  };
}

function add(target: UsageBucket, row: UsageTotals): void {
  target.scenarios += 1;
  target.calls += row.calls;
  target.questions += row.questions;
  target.inputTokens += row.inputTokens;
  target.outputTokens += row.outputTokens;
  target.waitMs += row.waitMs;
  target.retries += row.retries;
  target.costUsd = sumCost([target, row]);
}

/** Aggregate per-scenario usage into per-group and total buckets. */
export function aggregateUsage(rows: readonly ScenarioUsage[]): UsageSummary {
  const byGroup = new Map<string, UsageBucket>();
  const totals = emptyBucket();
  for (const row of rows) {
    const bucket = byGroup.get(row.group) ?? emptyBucket();
    add(bucket, row);
    byGroup.set(row.group, bucket);
    add(totals, row);
  }
  return {
    generatedAt: new Date().toISOString(),
    models: Array.from(new Set(rows.flatMap((r) => r.models))).sort(),
    totals,
    groups: Array.from(byGroup, ([group, bucket]) => ({ group, ...bucket })),
    scenarios: [...rows],
  };
}

export function formatUsd(value: number | null | undefined): string {
  return value === null || value === undefined ? "n/a" : `$${value.toFixed(6)}`;
}

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function renderTable(rows: string[][]): string {
  const widths = rows[0]!.map((_, col) => Math.max(...rows.map((row) => row[col]!.length)));
  const line = (row: string[]) =>
    row
      .map((cell, col) => (col === 0 ? cell.padEnd(widths[col]!) : cell.padStart(widths[col]!)))
      .join("  ");
  return [
    line(rows[0]!),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.slice(1).map(line),
  ].join("\n");
}

/** Plain-text usage report: one row per group, a total row, then per scenario. */
export function renderUsage(summary: UsageSummary, groupLabel = "Group"): string {
  if (summary.scenarios.length === 0) return "Semantic assertions: no scenario called the model.";
  const toRow = (label: string, b: UsageBucket) => [
    label,
    String(b.scenarios),
    String(b.calls),
    String(b.questions),
    b.inputTokens.toLocaleString("en-US"),
    b.outputTokens.toLocaleString("en-US"),
    formatUsd(b.costUsd),
    formatMs(b.waitMs),
    String(b.retries),
  ];
  const rows = [
    [
      groupLabel,
      "Scenarios",
      "Calls",
      "Questions",
      "Input tok",
      "Output tok",
      "Est. cost",
      "API wait",
      "Retries",
    ],
    ...summary.groups.map((g) => toRow(g.group, g)),
    toRow("Total", summary.totals),
  ];
  const avgWait = summary.totals.calls ? summary.totals.waitMs / summary.totals.calls : 0;
  const perScenario = summary.scenarios
    .map(
      (s) =>
        `  ${s.status.padEnd(8)} ${s.group} › ${s.scenario}: ${s.calls} call(s), ${s.inputTokens.toLocaleString("en-US")} input tok, ${formatUsd(s.costUsd)}, ${formatMs(s.waitMs)} waiting`,
    )
    .join("\n");
  return [
    `Semantic assertions usage (model ${summary.models.join(", ")}; average provider wait ${formatMs(avgWait)} per call; cost estimated by the provider from configured rates, n/a when unknown)`,
    renderTable(rows),
    "Per scenario:",
    perScenario,
  ].join("\n");
}
