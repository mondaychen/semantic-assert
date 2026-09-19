import { expect, test } from "@playwright/test";
import { FakeProvider } from "../packages/semantic-assert/dist/index.js";
import { PageJudge } from "../packages/semantic-assert-playwright/dist/index.js";
import { typesafe } from "../packages/semantic-assert-typesafe/dist/index.js";

test("captures a real page and judges it with a deterministic provider", async ({
  page,
}, testInfo) => {
  await page.setContent(
    "<main><h1>Projects</h1><p>Your project was saved successfully.</p></main>",
  );
  const provider = new FakeProvider({ scripts: [{ claim_0: 0.99 }] });
  const judge = new PageJudge(page, testInfo, provider);
  await judge.expectPageTo("The project was saved successfully");
  expect(JSON.stringify(provider.requests[0]?.state)).toContain("Projects");
  await judge.attachMetrics();
  expect(testInfo.attachments.map(({ name }) => name)).toContain("semantic-assert-metrics");
});

test.describe("live provider", () => {
  test.skip(
    !process.env.TYPESAFE_API_KEY,
    "Set TYPESAFE_API_KEY to run the live provider smoke test",
  );
  test("TypeSafe judges a local page", async ({ page }, testInfo) => {
    await page.setContent(
      "<main><h1>Projects</h1><p>Your project was saved successfully.</p></main>",
    );
    const judge = new PageJudge(page, testInfo, typesafe(), { timeoutMs: 15_000 });
    await judge.expectPageTo("The page confirms that the project was saved successfully");
    await judge.expectPageNotTo("The page reports that the project could not be saved");
    await judge.attachMetrics();
  });
});
