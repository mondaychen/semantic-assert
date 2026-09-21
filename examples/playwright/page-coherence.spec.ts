import type { Page } from "@playwright/test";
import { FakeProvider, SemanticAssertionError } from "semantic-assert";
import type { PageJudge } from "semantic-assert-playwright";
import { exampleProvider } from "../support/provider.js";
import { test, expect } from "./fixtures.js";

/**
 * A small app with a client-side router. Submitting the "New project" form
 * creates a project from whatever the user typed, normalizes the name, and
 * navigates to the project page: the title, breadcrumb, and heading all derive
 * from that name. When `updateTitle` is false, the router forgets the document
 * title, which is the kind of regression this example catches.
 */
async function renderApp(page: Page, updateTitle: boolean) {
  await page.setContent(`
    <title>New project · Acme Projects</title>
    <nav aria-label="Main">
      <a href="/">Home</a>
      <a href="/projects" aria-current="page">Projects</a>
      <a href="/docs">Docs</a>
    </nav>
    <main>
      <nav aria-label="Breadcrumb">Projects › New project</nav>
      <h1>New project</h1>
      <form>
        <label>Project name <input name="name" required></label>
        <button type="submit">Create project</button>
      </form>
    </main>
    <script>
      // Trim and title-case the name, as the real app would. The test does not
      // reimplement this, so it cannot predict the exact title.
      const normalize = (raw) =>
        raw.trim().replace(/\\s+/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase());
      document.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        const name = normalize(new FormData(event.target).get("name"));
        document.querySelector("main").innerHTML =
          '<nav aria-label="Breadcrumb">Projects › ' + name + "</nav>" +
          "<h1>" + name + "</h1>" +
          "<p>No tasks yet. Add the first task to get started.</p>";
        if (${updateTitle}) document.title = name + " · Acme Projects";
      });
    </script>
  `);
}

/** Judge the main content together with the title it must agree with. */
async function judgeCoherence(page: Page, judge: PageJudge, enteredName: string) {
  // One relationship per claim, so a failure says which signal went stale. The
  // first claim needs no expected value at all. The second anchors the page to
  // what the user typed, without guessing how the app will render it.
  return judge.expectPage(
    [
      {
        claim:
          "The document title, the breadcrumb, and the main heading all refer to the same project",
      },
      { claim: "The page is about the project the user named in `project_name_entered`" },
    ],
    { region: page.getByRole("main"), extraState: { project_name_entered: enteredName } },
  );
}

// What the user types. Deliberately messy: the app will trim and title-case it.
const enteredName = "  q3 launch plan  ";

test("after creating a project, the title, breadcrumb, and heading all name it", async ({
  page,
  judge,
  judgeProvider,
}) => {
  await renderApp(page, true);
  await page.getByLabel("Project name").fill(enteredName);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("New project");

  await judgeCoherence(page, judge, enteredName);

  if (judgeProvider instanceof FakeProvider) {
    // What the model sees: the main region, the rendered title, and the raw input.
    const sent = JSON.stringify(judgeProvider.requests[0]?.state);
    expect(sent).toContain('"title":"Q3 Launch Plan · Acme Projects"');
    expect(sent).toContain('"project_name_entered":"  q3 launch plan  "');
    expect(sent).toContain("Projects › Q3 Launch Plan");
    expect(sent).not.toContain("Create project");
  }
});

test.describe("a router that forgets the document title", () => {
  // Scripted scores for the broken app: the coherence claim fails, the
  // user-input claim passes because the heading and breadcrumb are right.
  test.use({ judgeProvider: exampleProvider({ scripts: [{ claim_0: 0.05, claim_1: 0.95 }] }) });

  test("is caught, and the failing claim points at the stale title", async ({ page, judge }) => {
    await renderApp(page, false);
    await page.getByLabel("Project name").fill(enteredName);
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("New project");
    // The title never left the form page.
    await expect(page).toHaveTitle("New project · Acme Projects");

    const error = await judgeCoherence(page, judge, enteredName).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SemanticAssertionError);
    const [coherence, aboutInput] = (error as SemanticAssertionError).results;
    expect(coherence?.passed).toBe(false);
    expect(aboutInput?.passed).toBe(true);
  });
});
