import { exampleProvider } from "../support/provider.js";
import { test, expect } from "./fixtures.js";
import { judgeTimeoutMs } from "../support/timing.js";

test.use({
  judgeProvider: exampleProvider({
    scripts: [{ classification: { choice: "loading" } }, { classification: { choice: "empty" } }],
  }),
});

test("a new project's search reaches an empty state with useful guidance", async ({
  page,
  judge,
}) => {
  await page.setContent(`
    <main aria-label="Search results"><p>Searching projects…</p></main>
    <script>
      setTimeout(() => {
        document.querySelector('main').innerHTML =
          '<h1>No projects found</h1><p>Try a different search or create your first project.</p>';
      }, 150);
    </script>
  `);

  const result = await judge.classifyPage(
    "What is the search results state?",
    {
      loading: "The search is in progress.",
      results: "The page lists matching projects.",
      empty: "No projects match and the page suggests what to do next.",
      error: "The search failed with an error.",
    },
    { region: "main", settled: ["results", "empty"], timeoutMs: judgeTimeoutMs },
  );

  // classifyPage returns the last answer on timeout; it does not assert success.
  expect(result.choice).toBe("empty");
  expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  await expect(page.getByRole("heading")).toHaveText("No projects found");
});
