---
title: Checkout confirmations
description: Go beyond a thank-you message to check that checkout confirms the purchase and explains what happens next.
---

# “Thanks” is visible. Did the order succeed?

The checkout test clicks the button and finds a thank-you message. It passes even
if the page never confirms the purchase or tells the customer what happens next.

## Before: look for a reassuring word

```ts
await page.getByRole("button", { name: "Place order" }).click();
const confirmation = page.getByRole("region", { name: "Order confirmation" });

await expect(confirmation).toContainText(/thanks|thank you/i);
```

“Thanks for your patience. We're still trying to process your payment” satisfies
this check. “Order confirmed. We'll email you when it ships” does not.

## After: check the customer's next decision

With the [Playwright judge fixture](../reference/playwright#fixture), keep exact
identifiers in ordinary assertions and describe the confirmation's meaning:

```ts
await page.getByRole("button", { name: "Place order" }).click();
const confirmation = page.getByRole("region", { name: "Order confirmation" });

await expect(confirmation).toBeVisible();
await expect(confirmation).toContainText("#1042");
await judge.expectPage(
  [
    { claim: "The purchase was successful" },
    { claim: "The customer is told how they will hear about shipping" },
    { claim: "The customer needs to retry payment", expected: false, threshold: 0.9 },
  ],
  { region: confirmation },
);
```

These claims test whether the page gives the customer enough information to stop
trying to pay and wait for shipping updates. The judge can recapture the region
while the confirmation loads. All three claims share one request per poll.

## Wording can change; the requirement stays

| Confirmation text                                                                | Intended outcome      | Reason                                             |
| -------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------- |
| “Thanks! Order #1042 is confirmed. We'll email you when it ships.”               | Accept                | Confirms success and explains the shipping update. |
| “You're all set. Order #1042 is placed. Watch your inbox for a dispatch notice.” | Accept                | Different wording, same information.               |
| “Thanks for your patience. Payment for order #1042 is still processing.”         | Reject if it persists | Does not confirm a successful purchase.            |
| “Order #1042 confirmed.”                                                         | Reject                | Omits how the customer will hear about shipping.   |

The model judges what the page says. It does not prove that a payment was charged
or an email was sent. Verify those effects through your application's APIs or test
doubles when they are part of the test.

## Run the existing checkout test

After [setting up the repository examples](https://github.com/mondaychen/semantic-assert/blob/main/examples/README.md):

```sh
pnpm --filter semantic-assert-examples test:playwright checkout.spec.ts --grep "checkout confirms"
```

The [runnable test](https://github.com/mondaychen/semantic-assert/blob/main/examples/playwright/checkout.spec.ts)
uses local HTML and a scripted provider by default. To evaluate the actual text,
set `AI_GATEWAY_API_KEY` in `.env` and run:

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env node_modules/@playwright/test/cli.js test --config=examples/playwright.config.ts checkout.spec.ts --grep "checkout confirms"
```

The table above gives calibration cases; the existing test demonstrates the
successful checkout. Add your own incomplete and contradictory confirmations
when choosing a threshold.
