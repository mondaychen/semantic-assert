---
title: Checkout confirmations
description: Go beyond a thank-you message to check that checkout confirms the purchase and explains what happens next.
---

# Checkout confirmations

<p class="page-hook">The page says “Thanks”... but did the order actually go through?</p>

Your checkout test clicks the button and finds a thank-you message. It passes even
when the page never confirms the purchase or tells the customer what happens next.

## Before: look for a reassuring word

```ts
await page.getByRole("button", { name: "Place order" }).click();
const confirmation = page.getByRole("region", { name: "Order confirmation" });

await expect(confirmation).toContainText(/thanks|thank you/i);
```

“Thanks for your patience. We're still trying to process your payment” satisfies
this check. “Order confirmed. We'll email you when it ships” doesn't.

## After: check the customer's next decision

With the [Playwright judge fixture](../reference/playwright#fixture), keep the
exact identifier in an ordinary assertion and describe what the confirmation has
to tell the customer:

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

These claims ask whether the customer has enough information to stop trying to
pay and wait for shipping updates. Playwright waits for the confirmation to be
visible and to contain the order ID. Then the judge evaluates all three claims in
one request. If the message keeps changing after that, wait for your
application's ready state or opt into polling with a positive `timeoutMs`.

## Wording can change. The requirement stays.

| Confirmation text                                                                | Intended outcome      | Reason                                             |
| -------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------- |
| “Thanks! Order #1042 is confirmed. We'll email you when it ships.”               | Accept                | Confirms success and explains the shipping update. |
| “You're all set. Order #1042 is placed. Watch your inbox for a dispatch notice.” | Accept                | Different wording, same information.               |
| “Thanks for your patience. Payment for order #1042 is still processing.”         | Reject if it persists | Doesn't confirm a successful purchase.             |
| “Order #1042 confirmed.”                                                         | Reject                | Omits how the customer will hear about shipping.   |

::: warning Pitfall
The model judges what the page says. It can't prove a payment was charged or an
email was sent. When those effects are part of the test, verify them through your
application's APIs or test doubles.
:::

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

The runnable test covers the successful checkout. Use the table above as your
calibration set, and add your own incomplete and contradictory confirmations when
you choose a threshold.
