// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

import { NotReadyError } from "semantic-assert";
import { RegionNotFoundError, capturePageState } from "./page-state";

/** Just enough of a Playwright Page for capturePageState. */
function fakePage(snapshot: string, regionCount = 1) {
  const waits: number[] = [];
  const locator = {
    count: async () => regionCount,
    first: () => ({
      waitFor: async ({ timeout }: { timeout: number }) => {
        waits.push(timeout);
        if (regionCount === 0) {
          const error = new Error(`locator.waitFor: Timeout ${timeout}ms exceeded.`);
          error.name = "TimeoutError";
          throw error;
        }
      },
    }),
    ariaSnapshot: async () => snapshot,
    getByRole: () => ({ evaluateAll: async () => [{ name: "Home", href: "/" }] }),
    evaluate: async (_fn: unknown, options: unknown) => [
      {
        text: "cited",
        element: "span",
        hints: ["highlighted background (light blue)", `opts:${JSON.stringify(options)}`],
      },
    ],
  };
  const page = {
    url: () => "https://x.test/p",
    title: async () => "T",
    locator: () => locator,
    // Links are read from the region, never from the whole page.
    getByRole: () => {
      throw new Error("page-wide link lookup");
    },
  } as unknown as Page;
  return Object.assign(page, { waits });
}

describe("capturePageState", () => {
  it("captures url, title and snapshot, merging extra state", async () => {
    const state = await capturePageState(fakePage("- heading"), {
      maxChars: 100,
      extraState: { chosen: "x" },
    });
    expect(state).toEqual({
      chosen: "x",
      url: "https://x.test/p",
      title: "T",
      aria_snapshot: "- heading",
    });
  });

  it("flags truncation and can include the region's links", async () => {
    const state = await capturePageState(fakePage("a".repeat(50)), {
      maxChars: 10,
      region: "main",
      includeLinks: true,
    });
    expect(state.truncated).toBe(true);
    expect(state.links).toEqual([{ name: "Home", href: "/" }]);
  });

  it("waits for the region with Playwright's default expect timeout, then reports not ready", async () => {
    const page = fakePage("", 0);
    const error = await capturePageState(page, { maxChars: 10, region: "main" }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RegionNotFoundError);
    expect((error as Error).message).toMatch(/did not appear .* within 5000ms/);
    expect((error as Error).message).toMatch(/locator\.waitFor\(\)/);
    expect(page.waits).toEqual([5000]);
  });

  it("waits no longer than regionTimeoutMs", async () => {
    const page = fakePage("- main", 1);
    await capturePageState(page, { maxChars: 10, region: "main", regionTimeoutMs: 250 });
    expect(page.waits).toEqual([250]);
  });

  it("caps the region wait at the remaining polling time", async () => {
    const page = fakePage("- main", 1);
    await capturePageState(
      page,
      { maxChars: 10, region: "main", regionTimeoutMs: 5000 },
      { pollingDeadline: Date.now() + 1000 },
    );
    expect(page.waits).toHaveLength(1);
    expect(page.waits[0]).toBeGreaterThan(0);
    expect(page.waits[0]).toBeLessThanOrEqual(1000);
  });

  it("checks once without waiting when regionTimeoutMs is 0 or no polling time remains", async () => {
    const immediate = fakePage("", 0);
    await expect(
      capturePageState(immediate, { maxChars: 10, region: "main", regionTimeoutMs: 0 }),
    ).rejects.toBeInstanceOf(RegionNotFoundError);
    expect(immediate.waits).toEqual([]);

    const expired = fakePage("", 0);
    await expect(
      capturePageState(
        expired,
        { maxChars: 10, region: "main" },
        { pollingDeadline: Date.now() - 1 },
      ),
    ).rejects.toBeInstanceOf(RegionNotFoundError);
    expect(expired.waits).toEqual([]);
  });

  it("rejects a negative region timeout", async () => {
    await expect(
      capturePageState(fakePage("- x"), { maxChars: 10, region: "main", regionTimeoutMs: -1 }),
    ).rejects.toThrow(/regionTimeoutMs must be a non-negative/);
  });

  it("rethrows waitFor failures that are not timeouts", async () => {
    const page = fakePage("- x", 1);
    page.locator = () =>
      ({
        first: () => ({
          waitFor: async () => {
            throw new Error("Target page, context or browser has been closed");
          },
        }),
      }) as never;
    await expect(capturePageState(page, { maxChars: 10, region: "main" })).rejects.toThrow(
      /has been closed/,
    );
  });

  it("rejects an ambiguous region with a plain error, not a retry", async () => {
    const error = await capturePageState(fakePage("", 2), { maxChars: 10, region: "p" }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(NotReadyError);
    expect((error as Error).message).toMatch(/matches 2 elements/);
  });

  it("applies the redaction hook last", async () => {
    const state = await capturePageState(fakePage("email a@b.c"), {
      maxChars: 100,
      redact: (s) => ({ ...s, aria_snapshot: s.aria_snapshot.replace(/\S+@\S+/, "[redacted]") }),
    });
    expect(state.aria_snapshot).toBe("email [redacted]");
  });

  it("adds visual hints only when asked, passing the options through", async () => {
    const plain = await capturePageState(fakePage("- text"), { maxChars: 100 });
    expect(plain.visual_hints).toBeUndefined();
    const hinted = await capturePageState(fakePage("- text"), {
      maxChars: 100,
      visualHints: { dataAttributes: ["data-state"] },
    });
    expect(hinted.visual_hints).toEqual([
      {
        text: "cited",
        element: "span",
        hints: ["highlighted background (light blue)", 'opts:{"dataAttributes":["data-state"]}'],
      },
    ]);
  });
});
