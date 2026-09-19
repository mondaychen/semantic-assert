// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

import { NotReadyError } from "semantic-assert";
import { RegionNotFoundError, capturePageState } from "./page-state";

/** Just enough of a Playwright Page for capturePageState. */
function fakePage(snapshot: string, regionCount = 1): Page {
  const locator = {
    count: async () => regionCount,
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
  return {
    url: () => "https://x.test/p",
    title: async () => "T",
    locator: () => locator,
    // Links are read from the region, never from the whole page.
    getByRole: () => {
      throw new Error("page-wide link lookup");
    },
  } as unknown as Page;
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

  it("reports a missing region as not ready", async () => {
    await expect(
      capturePageState(fakePage("", 0), { maxChars: 10, region: "main" }),
    ).rejects.toBeInstanceOf(RegionNotFoundError);
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
