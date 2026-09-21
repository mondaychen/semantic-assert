import { type Page, expect } from "@playwright/test";
import { Given, Then } from "./fixtures.js";

async function renderEditor(page: Page, alertCopy: string) {
  // Local HTML keeps the example runnable without a server. Use page.goto in your app.
  await page.setContent(`
    <main>
      <h1>Untitled document</h1>
      <aside>Help: if your changes were not saved, try again.</aside>
      <p role="alert">${alertCopy}</p>
    </main>
  `);
}

Given("the editor failed to save the user's changes", async ({ page }) => {
  await renderEditor(page, "We couldn't save your changes. Try again.");
});

Given("the editor shows the alert {string}", async ({ page }, copy: string) => {
  await renderEditor(page, copy);
});

// One step definition covers every "Then the alert ..." line. The Gherkin text
// is the claim, so a new requirement is a new line in the feature, not new code.
Then(/^the alert (.+)$/, async ({ page, judge }, requirement: string) => {
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await judge.expectPageTo(`The alert ${requirement}`, { region: alert });
});
