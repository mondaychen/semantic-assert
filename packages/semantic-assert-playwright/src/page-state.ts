// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { Locator, Page } from "@playwright/test";
import { type JsonValue, NotReadyError, truncateText } from "semantic-assert";

import { type VisualHintsOptions, collectVisualHints } from "./visual-hints";

/**
 * The state handed to the model is a textual snapshot of the page: the
 * accessibility tree (Playwright's aria snapshot) plus URL and title.
 * That is what a screen-reader user gets, which keeps judgments anchored to
 * user-visible behavior rather than markup.
 */
export interface PageState {
  // Index signature keeps the state assignable to JsonValue. Optional fields
  // (`links`, `truncated`) are added only when present so no `undefined` leaks
  // into the request body.
  [key: string]: JsonValue;
  url: string;
  title: string;
  /** YAML-like accessibility tree of the captured region. */
  aria_snapshot: string;
}

export interface CapturePageStateOptions {
  /**
   * Scope the snapshot to a Locator or CSS selector. Defaults to the whole
   * body. A region that is not on the page yet is reported as not ready so
   * polling assertions retry.
   */
  region?: Locator | string;
  /** Also collect the region's link accessible names and hrefs; aria snapshots omit hrefs. */
  includeLinks?: boolean;
  /**
   * Also report how text elements in the region look (highlighted background,
   * bold, dimmed, struck through, colour, chosen data attributes) as a
   * `visual_hints` list of named observations. Off by default: it costs an
   * extra evaluation and tokens, and most claims are about semantics.
   */
  visualHints?: boolean | VisualHintsOptions;
  /** Character cap for the aria snapshot. */
  maxChars?: number;
  /**
   * Named fields merged into the state, e.g. a value remembered by an earlier
   * step, so a claim can reference it by name.
   */
  extraState?: { [key: string]: JsonValue };
  /**
   * Last chance to redact or reshape what is sent to the API, e.g. to strip
   * customer data from the snapshot.
   */
  redact?: (state: PageState) => PageState;
}

/** The scoped region is not on the page (yet). Poll loops retry on this. */
export class RegionNotFoundError extends NotReadyError {
  constructor(region: string, url: string) {
    super(
      `Region "${region}" was not found on ${url}. Use a selector that exists on this page, or omit the region to snapshot the whole page.`,
    );
    this.name = "RegionNotFoundError";
  }
}

export async function capturePageState(
  page: Page,
  options: CapturePageStateOptions & { maxChars: number },
): Promise<PageState> {
  const {
    region = "body",
    includeLinks = false,
    visualHints = false,
    maxChars,
    extraState = {},
    redact,
  } = options;
  const target = typeof region === "string" ? page.locator(region) : region;
  const regionLabel = typeof region === "string" ? region : String(region);

  if (region !== "body" && (await target.count()) === 0) {
    throw new RegionNotFoundError(regionLabel, page.url());
  }
  const snapshot = await target.ariaSnapshot({ timeout: 5_000 });
  const { text, truncated } = truncateText(snapshot, maxChars);

  const state: PageState = {
    ...extraState,
    url: page.url(),
    title: await page.title(),
    aria_snapshot: text,
  };
  if (truncated) state.truncated = true;

  if (includeLinks) {
    state.links = await target.getByRole("link").evaluateAll((elements) =>
      elements.map((element) => ({
        name: (
          element.getAttribute("aria-label") ??
          element.querySelector("img")?.getAttribute("alt") ??
          element.textContent ??
          ""
        ).trim(),
        href: element.getAttribute("href") ?? "",
      })),
    );
  }

  if (visualHints) {
    const hintOptions = visualHints === true ? {} : visualHints;
    // Runs in the browser; the function is serialized, so it is self-contained.
    state.visual_hints = await target.evaluate(collectVisualHints, hintOptions);
  }

  return redact ? redact(state) : state;
}
