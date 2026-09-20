import assert from "node:assert/strict";
import { test } from "node:test";
import { exampleProvider } from "../support/provider.js";
import { jsonJudge } from "../support/json-judge.js";

test("a support response explains the next step without inventing a refund", async () => {
  // Replace this local sample with the JSON returned by your API or agent.
  const response = {
    status: 200,
    orderId: "ORDER-1042",
    customerMessage: "My parcel arrived damaged. What should I do?",
    reply:
      "I'm sorry your parcel arrived damaged. Please send a photo of the damage so our support team can review the next steps.",
  };

  // Exact facts belong in ordinary assertions.
  assert.equal(response.status, 200);
  assert.equal(response.orderId, "ORDER-1042");

  const judge = jsonJudge(
    exampleProvider({
      scripts: [{ claim_0: 0.98, claim_1: 0.96, claim_2: 0.02 }],
    }),
  );
  await judge.expectClaims(
    async () => response,
    [
      { claim: "The reply acknowledges the customer's damaged parcel empathetically" },
      { claim: "The reply gives the customer a concrete next step" },
      { claim: "The reply promises a refund", expected: false, threshold: 0.9 },
    ],
  ); // Static output: the default is a single evaluation.

  // All three claims share one captured state and one provider request.
  assert.equal(judge.metrics.totals.calls, 1);
  assert.equal(judge.metrics.totals.questions, 3);
  console.log("Support response usage:", judge.metrics.totals);
});
