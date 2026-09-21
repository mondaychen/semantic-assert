import type { Page } from "@playwright/test";
import { FakeProvider, SemanticAssertionError } from "semantic-assert";
import type { PageJudge } from "semantic-assert-playwright";
import { exampleProvider } from "../support/provider.js";
import { test, expect } from "./fixtures.js";

/**
 * A small client-side router. Clicking a nav link swaps the main content and
 * moves `aria-current`. When `updateTitle` is false, it forgets the document
 * title, which is the kind of regression this example catches.
 */
async function renderApp(page: Page, updateTitle: boolean) {
  await page.setContent(`
    <title>Home | Acme</title>
    <nav aria-label="Main">
      <a href="/" data-route="home" aria-current="page">Home</a>
      <a href="/pricing" data-route="pricing">Pricing</a>
      <a href="/docs" data-route="docs">Docs</a>
    </nav>
    <main>
      <nav aria-label="Breadcrumb"><a href="/">Home</a></nav>
      <h1>Welcome to Acme</h1>
      <p>Acme helps teams ship with confidence.</p>
    </main>
    <script>
      const pages = {
        home: {
          title: "Home | Acme",
          crumb: "Home",
          heading: "Welcome to Acme",
          body: "Acme helps teams ship with confidence.",
        },
        pricing: {
          title: "Pricing | Acme",
          crumb: "Home › Pricing",
          heading: "Plans and pricing",
          body: "Start free. Upgrade when your team grows.",
        },
        docs: {
          title: "Documentation | Acme",
          crumb: "Home › Docs",
          heading: "Documentation",
          body: "Guides and API reference for every Acme product.",
        },
      };
      document.querySelector('[aria-label="Main"]').addEventListener("click", (event) => {
        const link = event.target.closest("a[data-route]");
        if (!link) return;
        event.preventDefault();
        const next = pages[link.dataset.route];
        for (const a of document.querySelectorAll("a[data-route]")) {
          if (a === link) a.setAttribute("aria-current", "page");
          else a.removeAttribute("aria-current");
        }
        document.querySelector("main").innerHTML =
          '<nav aria-label="Breadcrumb">' + next.crumb + "</nav>" +
          "<h1>" + next.heading + "</h1><p>" + next.body + "</p>";
        if (${updateTitle}) document.title = next.title;
      });
    </script>
  `);
}

/** Judge the main content together with the two page-level signals it must agree with. */
async function judgeCoherence(page: Page, judge: PageJudge) {
  const main = page.getByRole("main");
  // The aria snapshot lists nav links but not aria-current, so name the
  // current item explicitly. The document title is already part of the state.
  const currentNavItem = await page
    .getByRole("navigation", { name: "Main" })
    .locator("[aria-current='page']")
    .textContent();

  // One relationship per claim, so a failure says which signal went stale.
  return judge.expectPage(
    [
      { claim: "The document title describes the same section as the main heading" },
      { claim: "The current navigation item names the section shown in the main content" },
    ],
    { region: main, extraState: { current_nav_item: currentNavItem ?? "" } },
  );
}

test("after navigating, the title, nav, and content all describe the same section", async ({
  page,
  judge,
  judgeProvider,
}) => {
  await renderApp(page, true);
  await page.getByRole("link", { name: "Pricing" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plans and pricing");

  await judgeCoherence(page, judge);

  if (judgeProvider instanceof FakeProvider) {
    // What the model sees: the main region, the title, and the named nav item.
    const sent = JSON.stringify(judgeProvider.requests[0]?.state);
    expect(sent).toContain('"title":"Pricing | Acme"');
    expect(sent).toContain('"current_nav_item":"Pricing"');
    expect(sent).toContain("Plans and pricing");
    expect(sent).not.toContain("Welcome to Acme");
  }
});

test.describe("a router that forgets the document title", () => {
  // Scripted scores for the broken app: the title claim fails, the nav claim passes.
  test.use({ judgeProvider: exampleProvider({ scripts: [{ claim_0: 0.04, claim_1: 0.96 }] }) });

  test("is caught, and the failing claim points at the stale title", async ({ page, judge }) => {
    await renderApp(page, false);
    await page.getByRole("link", { name: "Pricing" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plans and pricing");
    // Exact-string assertions would need the title's current wording. The
    // judge only needs the title and heading to disagree.
    await expect(page).toHaveTitle("Home | Acme");

    const error = await judgeCoherence(page, judge).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SemanticAssertionError);
    const [title, nav] = (error as SemanticAssertionError).results;
    expect(title?.passed).toBe(false);
    expect(nav?.passed).toBe(true);
  });
});
