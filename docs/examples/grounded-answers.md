---
title: Answers grounded in a policy
description: Catch generated answers that repeat the right keywords but contradict the policy provided to them.
---

# Answers grounded in a policy

<p class="page-hook">The answer says “30 days”... yet the advice is still wrong.</p>

A customer asks whether they can return opened headphones. Your policy allows
returns within 30 days, but only if the headphones are unopened. A generated
answer can quote the return window and still get eligibility wrong.

## Before: check that the answer mentions the policy

```ts
import assert from "node:assert/strict";

const policy =
  "Headphones can be returned within 30 days only if unopened. Opened headphones are not eligible for returns.";
const question = "I opened my headphones 10 days after buying them. Can I return them?";
const answer = "Yes, you can return your opened headphones within 30 days.";

assert.match(answer, /30 days/i); // Passes, despite contradicting the policy.
```

A keyword check can't tell whether the answer applies the rule correctly. An exact
expected answer has the opposite problem: a correct paraphrase fails.

## After: give the judge the source, the question, and the answer

With a configured [core judge](../getting-started), capture all three together so
the model can evaluate the relationship between them:

```ts
await judge.expectClaims(
  async () => ({ policy, question, answer }),
  [
    { claim: "The answer correctly applies the supplied policy to the customer's situation" },
    { claim: "The answer directly answers whether the customer can return the opened headphones" },
    {
      claim: "The answer invents an exception not present in the supplied policy",
      expected: false,
    },
  ],
  { threshold: 0.8 },
);
```

For the answer above, the intended result is a failed assertion. A good answer
would explain that opening the headphones makes them ineligible, even inside the
30-day window.

## Catch plausible but unsupported advice

| Generated answer                                                                                 | Intended outcome | Why                                                    |
| ------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------ |
| “Because you've opened the headphones, this policy doesn't allow a return, even within 30 days.” | Accept           | Applies the condition to the customer's situation.     |
| “The 30-day return window covers unopened headphones only. Your opened pair isn't eligible.”     | Accept           | A correct paraphrase.                                  |
| “Yes, you can return your opened headphones within 30 days.”                                     | Reject           | Ignores the unopened condition.                        |
| “Opened headphones are returnable if you pay a restocking fee.”                                  | Reject           | Invents an exception.                                  |
| “Our return window is 30 days.”                                                                  | Reject           | Leaves the customer's eligibility question unanswered. |

Use these intended outcomes to calibrate a live provider. A fake provider's
scripted scores can't tell you anything about the answers themselves.

## Use it in a retrieval or agent test

Replace `policy` with the source text your model was given, `question` with the
test customer's request, and `answer` with the generated response.

::: warning Pitfall
Keep the source in the captured state. If you capture only the answer, the judge
has nothing to check it against, and “correctly applies the policy” becomes a
guess.
:::

This checks consistency with the supplied source, not whether the source is
current or factually correct, and it doesn't prove that retrieval found every
relevant document. Test retrieval coverage and exact document IDs separately.

The same pattern works for generated summaries: capture the source alongside the
summary, then assert the facts that must survive. Leave exact prices, dates,
counts, and other deterministic values to code.
