import { expect as baseExpect, test as base } from "@playwright/test";
import { FakeProvider } from "../packages/semantic-assert/dist/index.js";
import {
  type JudgeFixtureOptions,
  type JudgeFixtures,
  createJudgeExpect,
  judgeFixtures,
} from "../packages/semantic-assert-playwright/dist/index.js";

const PAGE =
  "<main><h1>Projects</h1><section aria-label='List'><p>No projects yet.</p></section></main>";

base.describe("createJudgeExpect", () => {
  base("passes on a page and on a locator, attaching evidence and metrics", async ({ page }) => {
    await page.setContent(PAGE);
    const provider = new FakeProvider({ scripts: [{ claim_0: 0.95, claim_1: 0.05 }] });
    const expect = createJudgeExpect({ provider, options: { threshold: 0.8 } });

    await expect(page).toSatisfy("There is a heading named Projects");
    await expect(page.getByRole("region", { name: "List" })).toSatisfyAll([
      "The list is empty",
      { claim: "Projects are listed", expected: false },
    ]);

    // The locator call captured only its region.
    baseExpect(JSON.stringify(provider.requests[1]?.state)).not.toContain("Projects");
    const names = base.info().attachments.map((a) => a.name);
    baseExpect(names.filter((n) => n === "semantic-answers")).toHaveLength(2);
    baseExpect(names.filter((n) => n === "semantic-assert-metrics")).toHaveLength(2);
  });

  base("fails with the per-claim breakdown when a claim misses", async ({ page }) => {
    await page.setContent(PAGE);
    const expect = createJudgeExpect({
      provider: new FakeProvider({ scripts: [{ claim_0: 0.2 }] }),
      options: { timeoutMs: 0 },
    });
    const error = await expect(page)
      .toSatisfy("The page shows an error")
      .catch((e: unknown) => e as Error);
    baseExpect(error).toBeInstanceOf(Error);
    baseExpect((error as Error).message).toMatch(/FAIL {2}p\(yes\)=0\.20/);
    baseExpect(base.info().attachments.map((a) => a.name)).toContain("semantic-state");
  });

  base("rejects .not", async ({ page }) => {
    await page.setContent(PAGE);
    const expect = createJudgeExpect({ provider: new FakeProvider() });
    await baseExpect(expect(page).not.toSatisfy("anything")).rejects.toThrow(/expected: false/);
  });
});

const test = base.extend<JudgeFixtures & JudgeFixtureOptions>({
  ...judgeFixtures,
  judgeProvider: [new FakeProvider({ scripts: [{ claim_0: 0.85 }] }), { option: true }],
});
test.use({ judgeOptions: { threshold: 0.8, timeoutMs: 0 } });

test.describe("judge fixture", () => {
  test("provides a PageJudge configured from judgeOptions", async ({ page, judge }) => {
    await page.setContent(PAGE);
    baseExpect(judge.settings.threshold).toBe(0.8);
    const result = await judge.expectPageTo("There is a heading named Projects");
    baseExpect(result).toMatchObject({ passed: true, probability: 0.85, threshold: 0.8 });
    baseExpect(judge.metrics.totals.calls).toBe(1);
  });

  test("fails a claim below the configured threshold", async ({ page, judge }) => {
    await page.setContent(PAGE);
    await baseExpect(judge.expectPageTo("Anything", { threshold: 0.9 })).rejects.toThrow(
      /did not agree/,
    );
  });
});
