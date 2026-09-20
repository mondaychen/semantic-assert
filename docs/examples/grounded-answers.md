---
title: Answers grounded in a policy
description: Catch generated answers that repeat the right keywords but contradict the policy provided to them.
---

# The answer says “30 days”. The advice is still wrong.

A customer asks whether they can return opened headphones. Your policy allows
returns within 30 days only when the headphones are unopened. A generated answer
can repeat the return window and still get eligibility wrong.

## Before: check that the answer mentions the policy

```ts
import assert from "node:assert/strict";

const policy =
  "Headphones can be returned within 30 days only if unopened. Opened headphones are not eligible for returns.";
const question = "I opened my headphones 10 days after buying them. Can I return them?";
const answer = "Yes, you can return your opened headphones within 30 days.";

assert.match(answer, /30 days/i); // Passes, despite contradicting the policy.
```

Checking for a keyword cannot tell whether the answer applies the rule correctly.
An exact expected answer has the opposite problem: a correct paraphrase fails.

## After: compare the answer with its source and question

With a configured [core judge](../getting-started), capture the policy, question,
and answer together:

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

The intended result for the answer above is a failed assertion. A suitable answer
would explain that opening the headphones makes them ineligible even within the
30-day window. The model gets the source text and the customer's situation, so
it can evaluate the relationship between them.

## Catch plausible but unsupported advice

| Generated answer                                                                                 | Intended outcome | Why                                                    |
| ------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------ |
| “Because you've opened the headphones, this policy doesn't allow a return, even within 30 days.” | Accept           | Applies the condition to the customer's situation.     |
| “The 30-day return window covers unopened headphones only. Your opened pair isn't eligible.”     | Accept           | A correct paraphrase.                                  |
| “Yes, you can return your opened headphones within 30 days.”                                     | Reject           | Ignores the unopened condition.                        |
| “Opened headphones are returnable if you pay a restocking fee.”                                  | Reject           | Invents an exception.                                  |
| “Our return window is 30 days.”                                                                  | Reject           | Leaves the customer's eligibility question unanswered. |

Use these intended outcomes to calibrate a live provider. Do not infer success
from a fake provider's scripted scores.

## Use it in a retrieval or agent test

Replace `policy` with the source text supplied to your model, `question` with the
test customer's request, and `answer` with the generated response. Keep the source
in captured state; checking only the answer would leave the judge without the
evidence it needs.

This evaluates consistency with the supplied source, not whether the source is
current or factually correct. It also does not prove that retrieval found every
relevant document. Test retrieval coverage and exact document IDs separately.

The same pattern works for generated summaries: capture the source alongside the
summary, then assert the important facts that must be preserved. Use code for
exact prices, dates, counts, and other values that can be checked deterministically.
