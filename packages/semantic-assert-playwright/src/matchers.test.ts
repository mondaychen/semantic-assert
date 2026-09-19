// Copyright (c) 2026 Normal Computing Corporation
// SPDX-License-Identifier: Apache-2.0

import type { ExpectMatcherState, Page } from "@playwright/test";
import { FakeProvider } from "semantic-assert";
import { describe, expect, it } from "vitest";

import { createJudgeMatchers } from "./matchers";

describe("createJudgeMatchers", () => {
  it("rejects .not before touching the page", async () => {
    const matchers = createJudgeMatchers({ provider: new FakeProvider() });
    const negated = { isNot: true } as ExpectMatcherState;
    const page = {} as Page;
    await expect(matchers.toSatisfy.call(negated, page, "c")).rejects.toThrow(/expected: false/);
    await expect(matchers.toSatisfyAll.call(negated, page, ["c"])).rejects.toThrow(
      /expected: false/,
    );
  });
});
