import { expect, test } from "@playwright/test";
import {
  type VisualHint,
  capturePageState,
  collectVisualHints,
} from "../packages/semantic-assert-playwright/dist/index.js";

const DOCUMENT = `
  <article style="color: black; background: white">
    <p>Plain paragraph text.</p>
    <p><mark>Highlighted passage.</mark></p>
    <p><strong>Bold passage.</strong></p>
    <p><em>Italic passage.</em></p>
    <p><s>Struck passage.</s></p>
    <p><u>Underlined passage.</u></p>
    <p><span style="opacity: 0.4">Dimmed passage.</span></p>
    <p><span style="color: rgb(200, 0, 0)">Red passage.</span></p>
    <p><span data-state="active" data-empty="">Tagged passage.</span></p>
    <p><button style="background: rgb(0, 100, 255); color: white">Blue button</button></p>
    <p><a href="/x">Underlined link</a></p>
    <p hidden>Hidden passage.</p>
    <div style="background: rgb(220, 240, 255)"><p>Nested on light blue.</p></div>
  </article>
`;

function byText(hints: VisualHint[]): Map<string, VisualHint> {
  return new Map(hints.map((h) => [h.text, h]));
}

test("names how visible text looks, relative to its surroundings", async ({ page }) => {
  await page.setContent(DOCUMENT);
  const hints = await page
    .getByRole("article")
    .evaluate(collectVisualHints, { dataAttributes: ["data-state", "data-empty"] });
  const found = byText(hints);

  expect(found.has("Plain paragraph text.")).toBe(false);
  expect(found.has("Hidden passage.")).toBe(false);
  expect(found.get("Highlighted passage.")?.hints).toEqual([
    expect.stringMatching(/^highlighted background \((light )?yellow\)$/),
  ]);
  expect(found.get("Bold passage.")).toMatchObject({ element: "strong", hints: ["bold"] });
  expect(found.get("Italic passage.")?.hints).toEqual(["italic"]);
  expect(found.get("Struck passage.")?.hints).toEqual(["struck through"]);
  expect(found.get("Underlined passage.")?.hints).toEqual(["underlined"]);
  expect(found.get("Dimmed passage.")?.hints).toEqual(["dimmed"]);
  expect(found.get("Red passage.")?.hints).toEqual(["red text"]);
  expect(found.get("Tagged passage.")?.hints).toEqual(["data-state=active", "data-empty"]);
  // Controls never get the background hint; links never get the underline hint.
  expect(found.get("Blue button")?.hints ?? []).not.toContainEqual(
    expect.stringMatching(/highlighted/),
  );
  expect(found.get("Underlined link")?.hints).toEqual(["blue text"]);
  // Text with no own styling stays silent even when an ancestor is coloured.
  expect(found.has("Nested on light blue.")).toBe(false);
});

test("caps entries and text length", async ({ page }) => {
  await page.setContent(DOCUMENT);
  const hints = await page
    .getByRole("article")
    .evaluate(collectVisualHints, { maxEntries: 2, maxTextChars: 5 });
  expect(hints).toHaveLength(2);
  for (const hint of hints) expect(hint.text.length).toBeLessThanOrEqual(6);
  expect(hints[0]!.text.endsWith("…")).toBe(true);
});

test("capturePageState adds visual_hints only when asked", async ({ page }) => {
  await page.setContent(DOCUMENT);
  const plain = await capturePageState(page, { maxChars: 10_000, region: "article" });
  expect(plain.visual_hints).toBeUndefined();
  const hinted = await capturePageState(page, {
    maxChars: 10_000,
    region: "article",
    visualHints: true,
  });
  const hints = hinted.visual_hints as VisualHint[];
  expect(hints.map((h) => h.text)).toContain("Bold passage.");
  expect(hinted.aria_snapshot).toContain("Highlighted passage.");
});
