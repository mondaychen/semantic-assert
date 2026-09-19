// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import { type JudgeTemplates, choice, noul } from "semantic-assert";

/**
 * Question templates that name the fields `capturePageState` produces. The
 * `PageJudge` applies them by default; pass `templates` in its options to
 * override any of them.
 */
export const pageTemplates: Pick<JudgeTemplates, "claim" | "classification"> = {
  claim: (claim) =>
    noul(
      {
        statement: claim,
        question:
          "Is `statement` true of the web page captured in the state? Judge only from `aria_snapshot` (the page's accessibility tree), `url`, `title`, and when present `links` (link names and hrefs) and `visual_hints` (how text elements look: highlighted background, bold, dimmed, struck through, colour, data attributes).",
      },
      {
        true: "The captured page clearly shows the statement holds.",
        false: "The captured page does not show it, or shows the opposite.",
      },
    ),
  classification: (instructions, criteria) =>
    choice(
      {
        question: instructions,
        note: "Judge only from `aria_snapshot` (the page's accessibility tree), `url`, `title`, and `visual_hints` when present.",
      },
      criteria,
    ),
};
