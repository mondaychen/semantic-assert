// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { Locator, Page } from "@playwright/test";
import { type CaptureContext, type JsonValue, NotReadyError, truncateText } from "semantic-assert";

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

/**
 * How long a capture waits for its `region` to attach, in milliseconds. Matches
 * Playwright's default `expect` timeout, so a semantic assertion on a locator
 * waits the way a built-in locator assertion does.
 */
export const DEFAULT_REGION_TIMEOUT_MS = 5_000;

export interface CapturePageStateOptions {
  /**
   * Scope the snapshot to a Locator or CSS selector. Defaults to the whole
   * body. The capture waits up to `regionTimeoutMs` for the region to attach,
   * then reports it as not ready.
   */
  region?: Locator | string;
  /**
   * How long to wait for `region` to attach before giving up, in
   * milliseconds. Defaults to `DEFAULT_REGION_TIMEOUT_MS` (5 s). This is a
   * browser-side wait and costs no model requests; it is separate from
   * `timeoutMs`, which governs re-evaluation by the model. Set 0 to check
   * once without waiting.
   */
  regionTimeoutMs?: number;
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

/**
 * The scoped region did not attach within the region wait. A `NotReadyError`,
 * so an assertion that polls (positive `timeoutMs`) re-captures while time
 * remains; a single evaluation surfaces it to the caller.
 */
export class RegionNotFoundError extends NotReadyError {
  constructor(region: string, url: string, waitedMs: number) {
    super(
      `Region "${region}" did not appear on ${url} within ${waitedMs}ms. Wait for it first (await locator.waitFor()), raise regionTimeoutMs, or check the selector. Omit the region to snapshot the whole page.`,
    );
    this.name = "RegionNotFoundError";
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

/**
 * Wait for the region to attach, for up to `regionTimeoutMs` or the remaining
 * polling time, whichever is shorter. A zero budget checks once. Playwright
 * treats a zero `waitFor` timeout as unlimited, so it is never passed through.
 */
async function waitForRegion(
  target: Locator,
  regionLabel: string,
  url: () => string,
  regionTimeoutMs: number,
  context: CaptureContext,
): Promise<void> {
  const remaining =
    context.pollingDeadline === undefined ? Infinity : context.pollingDeadline - Date.now();
  const budget = Math.max(0, Math.ceil(Math.min(regionTimeoutMs, remaining)));
  if (budget === 0) {
    if ((await target.count()) === 0) throw new RegionNotFoundError(regionLabel, url(), 0);
    return;
  }
  try {
    await target.first().waitFor({ state: "attached", timeout: budget });
  } catch (error) {
    if (isTimeoutError(error)) throw new RegionNotFoundError(regionLabel, url(), budget);
    throw error;
  }
}

export async function capturePageState(
  page: Page,
  options: CapturePageStateOptions & { maxChars: number },
  context: CaptureContext = {},
): Promise<PageState> {
  const {
    region = "body",
    regionTimeoutMs = DEFAULT_REGION_TIMEOUT_MS,
    includeLinks = false,
    visualHints = false,
    maxChars,
    extraState = {},
    redact,
  } = options;
  if (!Number.isFinite(regionTimeoutMs) || regionTimeoutMs < 0) {
    throw new Error(
      `regionTimeoutMs must be a non-negative number of milliseconds, got ${regionTimeoutMs}`,
    );
  }
  const target = typeof region === "string" ? page.locator(region) : region;
  const regionLabel = typeof region === "string" ? region : String(region);

  if (region !== "body") {
    await waitForRegion(target, regionLabel, () => page.url(), regionTimeoutMs, context);
    const matches = await target.count();
    if (matches > 1) {
      // Not a NotReadyError: more matches will not resolve by polling.
      throw new Error(
        `Region "${regionLabel}" matches ${matches} elements on ${page.url()}. Narrow the selector to one element, e.g. with .first() or a role and name.`,
      );
    }
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
