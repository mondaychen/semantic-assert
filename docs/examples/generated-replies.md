---
title: Generated support replies
description: Test the promises a support bot makes instead of maintaining lists of forbidden words.
---

# Generated support replies

<p class="page-hook">The bot just promised a refund? How did the CI pass?</p>

Your support bot must not promise a refund before a human review. How do you test
that when every generated reply uses different words?

## Before: maintain forbidden words

```ts
import assert from "node:assert/strict";

const reply = "We'll put the money back on your card.";
assert.doesNotMatch(reply, /refund/i); // Passes. The promise slips through.
```

Add more patterns and you get the opposite problem: “I can't promise a refund
until we've reviewed your case” fails the same check.

## After: assert the rule

With a configured [core judge](../getting-started), state the rule as a negative
claim:

```ts
await judge.expectClaims(
  async () => ({ reply }),
  [{ claim: "The reply promises the customer a refund", expected: false }],
);
```

The model judges whether the reply makes a promise, paraphrases like “money back”
included. The claim says what you require without enumerating every way to say
it.

::: warning Pitfall
`expected: false` asks for evidence that the claim is false. That's not the same
as a positive claim failing. If you need to know a promise is absent, say so.
:::

## Check the whole response in one request

Keep exact facts in ordinary assertions, then batch every meaning-based check
into one call:

```ts
import assert from "node:assert/strict";

// Replace this sample with the response returned by your API or agent.
const response = {
  status: 200,
  orderId: "ORDER-1042",
  customerMessage: "My parcel arrived damaged. What should I do?",
  reply:
    "I'm sorry your parcel arrived damaged. Please send a photo of the damage so our support team can review the next steps.",
};

assert.equal(response.status, 200);
assert.equal(response.orderId, "ORDER-1042");

await judge.expectClaims(
  async () => response,
  [
    { claim: "The reply acknowledges the customer's damaged parcel empathetically" },
    { claim: "The reply gives the customer a concrete next step" },
    { claim: "The reply promises a refund", expected: false, threshold: 0.9 },
  ],
);
```

All three claims share one captured state and one provider request. The refund
claim carries a stricter threshold because it's the one that matters most. The
response is fixed, so the judge evaluates it once rather than retrying the same
content.

## Run the example

From a repository checkout, install and build the packages:

```sh
pnpm install
pnpm build
pnpm --filter semantic-assert-examples exec node --test dist/core/generated-response.test.js
```

The default fake provider returns scripted scores. To evaluate the content with a
live model, put `AI_GATEWAY_API_KEY` in `.env` and run:

```sh
EXAMPLE_PROVIDER=ai-sdk node --env-file=.env --test examples/dist/core/generated-response.test.js
```

Read the [complete test](https://github.com/mondaychen/semantic-assert/blob/main/examples/core/generated-response.test.ts)
for usage metrics and the shared provider setup. Model judgments are probabilistic,
so calibrate with examples of both permitted replies and forbidden promises.
