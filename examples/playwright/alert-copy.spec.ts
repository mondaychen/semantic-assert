import { test, expect } from "@playwright/test";
import { SemanticAssertionError } from "semantic-assert";
import { PageJudge } from "semantic-assert-playwright";
import { exampleProvider } from "../support/provider.js";

const cases = [
  {
    name: "original alert explains the failure and recovery step",
    copy: "We couldn't save your changes. Try again.",
    shouldPass: true,
  },
  {
    name: "PM copy edit preserves the failure and recovery step",
    copy: "Your changes haven't been saved. Please give it another try.",
    shouldPass: true,
  },
  {
    name: "vague alert is rejected even when recovery advice appears elsewhere",
    copy: "Something went wrong.",
    shouldPass: false,
  },
];

for (const { name, copy, shouldPass } of cases) {
  test(name, async ({ page }, testInfo) => {
    // Fake scores illustrate the flow, not language understanding. Opt into a
    // live provider to evaluate whether each wording satisfies the same claims.
    const provider = exampleProvider({
      scripts: [{ claim_0: shouldPass ? 0.99 : 0.01, claim_1: shouldPass ? 0.98 : 0.02 }],
    });
    const judge = new PageJudge(page, testInfo, provider, { threshold: 0.8 });
    await page.setContent(`
      <main>
        <aside>Help: if your changes were not saved, try again.</aside>
        <p role="alert">${copy}</p>
      </main>
    `);

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    const judgment = judge.expectPage(
      [
        { claim: "The alert tells the user their changes were not saved" },
        { claim: "The alert asks the user to try again" },
      ],
      { region: alert },
    );

    try {
      if (shouldPass) {
        await judgment;
      } else {
        await expect(judgment).rejects.toThrow(SemanticAssertionError);
      }
    } finally {
      // Record the model usage for the reporter even when the judgment fails.
      await judge.attachMetrics();
    }
  });
}
