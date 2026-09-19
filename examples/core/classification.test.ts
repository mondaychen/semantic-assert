import assert from "node:assert/strict";
import { test } from "node:test";
import { choice, noul } from "semantic-assert";
import { exampleProvider } from "../support/provider.js";
import { jsonJudge } from "../support/json-judge.js";

test("route a support ticket using typed questions in one request", async () => {
  const judge = jsonJudge(
    exampleProvider({
      scripts: [
        {
          department: { choice: "billing", confidence: 1 },
          needsReply: 0.99,
        },
      ],
    }),
  );
  const { answers } = await judge.evaluate(
    {
      subject: "Charged twice",
      message:
        "My subscription renewed yesterday and I see two charges. Can you help reverse the duplicate?",
    },
    {
      department: choice("Which team should handle this ticket?", {
        billing: "Payments, subscriptions, invoices, or refunds.",
        technical: "Broken functionality or problems using the product.",
        sales: "Questions about buying the product.",
      }),
      needsReply: noul("Is the customer asking for help that needs a reply?"),
    },
  );

  // evaluate does not enforce thresholds. The caller owns the acceptance policy.
  assert.equal(answers.department.choice, "billing");
  assert.ok(answers.department.confidence >= 0.8, "Send uncertain tickets to manual review");
  assert.ok(answers.needsReply.noul >= 0.8);
});

test("wait for a search to reach a usable state", async () => {
  const judge = jsonJudge(
    exampleProvider({
      scripts: [
        { classification: { choice: "loading" } },
        { classification: { choice: "results" } },
      ],
    }),
  );
  let captures = 0;
  const answer = await judge.classify(
    async () => {
      captures += 1;
      return captures === 1
        ? { message: "Searching the help center…", articles: [] }
        : { message: "Found an article: Reset your password", articles: ["Reset your password"] };
    },
    "What state is this help-center search in?",
    {
      loading: "The search is still in progress.",
      results: "Matching articles are available.",
      empty: "The search finished without matching articles.",
      error: "The search failed.",
    },
    { settled: ["results", "empty"] },
  );

  // A timeout returns the last answer, even if it is not settled. Check it.
  assert.ok(
    ["results", "empty"].includes(answer.choice),
    `Search did not settle: ${answer.choice}`,
  );
  assert.ok(answer.confidence >= 0.8);
});
