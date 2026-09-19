// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { Page } from "@playwright/test";
import { FakeProvider, defaultTemplates } from "semantic-assert";
import { describe, expect, it } from "vitest";

import { PageJudge } from "./context";
import { pageTemplates } from "./page-templates";

const page = { waitForTimeout: async () => {} } as unknown as Page;

describe("PageJudge", () => {
  it("applies the page templates over the core defaults", () => {
    const judge = new PageJudge(page, undefined, new FakeProvider());
    expect(judge.settings.templates.claim("x")).toEqual(pageTemplates.claim("x"));
    expect(judge.settings.templates.classification("q", { a: "A" })).toEqual(
      pageTemplates.classification("q", { a: "A" }),
    );
    expect(judge.settings.templates.urlClaim).toBe(defaultTemplates.urlClaim);
  });

  it("lets judge options replace individual page templates", () => {
    const claim = (c: string) => ({ type: "noul" as const, instructions: c });
    const judge = new PageJudge(page, undefined, new FakeProvider(), { templates: { claim } });
    expect(judge.settings.templates.claim).toBe(claim);
    expect(judge.settings.templates.classification).toBe(pageTemplates.classification);
  });
});
