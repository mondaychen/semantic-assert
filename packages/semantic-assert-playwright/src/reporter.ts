// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

/**
 * Playwright reporter that aggregates semantic-assert usage across the run.
 *
 * Each scenario attaches a metrics JSON (see PageJudge.attachMetrics).
 * Workers are separate processes, so attachments are the channel back to this
 * reporter, which runs in the main process. It prints a per-group table at the
 * end and writes the same data as JSON.
 */

import fs from "node:fs";
import path from "node:path";
import type { FullConfig, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import {
  type CallMetrics,
  METRICS_ATTACHMENT,
  type ScenarioMetrics,
  type ScenarioUsage,
  aggregateUsage,
  renderUsage,
  summarizeCalls,
} from "semantic-assert";

export interface UsageReporterOptions {
  /** Where to write the JSON summary, relative to the Playwright config file. */
  outputFile?: string;
  /** Print the table to stdout at the end of the run. Default true. */
  printTable?: boolean;
  /** Table header for the grouping column. Default "Feature". */
  groupLabel?: string;
}

/**
 * Merge every metrics attachment on a result. The fixture attaches once per
 * scenario, but each matcher call attaches its own, so a test can carry several.
 */
function parseMetrics(result: TestResult): ScenarioMetrics | null {
  const calls = result.attachments
    .filter((a) => a.name === METRICS_ATTACHMENT && a.body)
    .flatMap((a) => (JSON.parse(a.body!.toString("utf8")) as ScenarioMetrics).calls);
  return calls.length === 0 ? null : summarizeCalls(calls);
}

/** The enclosing describe block: the Feature for playwright-bdd, else the file. */
function groupTitle(test: TestCase): string {
  return test.parent.title || path.basename(test.location.file);
}

/** Every attempt of one test: retries spend real tokens, so their calls add up. */
interface Scenario {
  group: string;
  scenario: string;
  status: string;
  calls: CallMetrics[];
}

export default class UsageReporter implements Reporter {
  private readonly scenarios = new Map<string, Scenario>();
  private baseDir = process.cwd();

  constructor(private readonly options: UsageReporterOptions = {}) {}

  onBegin(config: FullConfig): void {
    // config.rootDir is the test directory, so resolve against the config
    // file's directory to land next to Playwright's own output folders.
    this.baseDir = config.configFile ? path.dirname(config.configFile) : config.rootDir;
  }

  /** Called once per attempt; retries of one test merge into a single row. */
  onTestEnd(test: TestCase, result: TestResult): void {
    const metrics = parseMetrics(result);
    if (!metrics) return;
    const existing = this.scenarios.get(test.id);
    if (existing) {
      existing.calls.push(...metrics.calls);
      existing.status = result.status;
      return;
    }
    this.scenarios.set(test.id, {
      group: groupTitle(test),
      scenario: test.title,
      status: result.status,
      calls: metrics.calls,
    });
  }

  onEnd(): void {
    const rows: ScenarioUsage[] = Array.from(this.scenarios.values(), (s) => {
      const { totals } = summarizeCalls(s.calls);
      return {
        group: s.group,
        scenario: s.scenario,
        status: s.status,
        models: Array.from(new Set(s.calls.map((c) => c.model))),
        ...totals,
        // Attachments written by older versions may predate the cost field.
        costUsd: totals.costUsd ?? null,
      };
    });
    const summary = aggregateUsage(rows);
    if (this.options.outputFile) {
      const file = path.resolve(this.baseDir, this.options.outputFile);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(summary, null, 2));
    }
    if (this.options.printTable ?? true) {
      console.log(`\n${renderUsage(summary, this.options.groupLabel ?? "Feature")}\n`);
    }
  }
}
