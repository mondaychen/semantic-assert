import { test } from "@playwright/test";
import { createJudgeExpect } from "semantic-assert-playwright";
import { exampleProvider } from "../support/provider.js";
import { judgeTimeoutMs } from "../support/timing.js";

test("a document highlights the cited passage and marks obsolete guidance", async ({ page }) => {
  const expect = createJudgeExpect({
    provider: exampleProvider({ scripts: [{ claim_0: 0.99, claim_1: 0.98, claim_2: 0.01 }] }),
    options: { threshold: 0.8, timeoutMs: judgeTimeoutMs },
  });
  await page.setContent(`
    <article aria-label="Return policy">
      <h1>Return policy</h1>
      <p><mark data-highlight-kind="citation">Unopened items can be returned within 30 days.</mark></p>
      <p><s>Returns must be requested by phone.</s> Start your return from your account.</p>
    </article>
  `);

  await expect(page.getByRole("article")).toSatisfyAll(
    [
      "The passage about the return window has a highlighted background",
      "The instruction to request returns by phone is struck through",
      { claim: "The return window passage is struck through", expected: false },
    ],
    { visualHints: { dataAttributes: ["data-highlight-kind"] } },
  );
  // Semantic negation uses expected: false. These matchers do not support .not.
});
