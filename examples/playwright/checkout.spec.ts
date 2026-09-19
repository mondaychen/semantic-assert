import { FakeProvider } from "semantic-assert";
import { test, expect } from "./fixtures.js";

test("checkout confirms the purchase and explains what happens next", async ({ page, judge }) => {
  // Local HTML keeps the example runnable without a server. Use page.goto in your app.
  await page.setContent(`
    <main>
      <h1>Review your order</h1>
      <p>Total: $24.00</p>
      <button onclick="document.querySelector('#confirmation').hidden = false">Place order</button>
      <section id="confirmation" aria-label="Order confirmation" hidden>
        <h2>Thanks for your order!</h2>
        <p>Order #1042 is confirmed. We will email you when it ships.</p>
        <a href="/orders/1042">View your order</a>
      </section>
    </main>
  `);
  await page.getByRole("button", { name: "Place order" }).click();
  const confirmation = page.getByRole("region", { name: "Order confirmation" });

  // Check exact identifiers with Playwright; judge meaning in a scoped region.
  await expect(confirmation).toContainText("#1042");
  await judge.expectPage(
    [
      { claim: "The purchase was successful" },
      { claim: "The customer is told how they will hear about shipping" },
      { claim: "The customer needs to retry payment", expected: false, threshold: 0.9 },
    ],
    { region: confirmation },
  );
});

test("redact account data before judging an error message", async ({
  page,
  judge,
  judgeProvider,
}) => {
  await page.setContent(`
    <aside>Unrelated account history</aside>
    <section aria-label="Email preferences">
      <h1>Email preferences</h1>
      <p>Account: alex@example.test</p>
      <p role="alert">We couldn't save your preferences. Check your connection and try again.</p>
    </section>
  `);

  await judge.expectPageTo("The error explains what the user can do to recover", {
    region: page.getByRole("region", { name: "Email preferences" }),
    // This sample's only sensitive field is the email in the snapshot.
    // Review URL, title, links, visual hints, and extraState when using those fields.
    redact: (state) => ({
      ...state,
      aria_snapshot: state.aria_snapshot.replaceAll("alex@example.test", "[email redacted]"),
    }),
  });

  if (judgeProvider instanceof FakeProvider) {
    const sent = JSON.stringify(judgeProvider.requests[0]?.state);
    expect(sent).toContain("[email redacted]");
    expect(sent).not.toContain("alex@example.test");
    expect(sent).not.toContain("Unrelated account history");
  }
});
