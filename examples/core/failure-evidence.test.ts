import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeProvider, SemanticAssertionError } from "semantic-assert";
import { jsonJudge } from "../support/json-judge.js";

test("inspect a failed assertion and its captured evidence", async () => {
  // Keep failure handling deterministic, including when other examples run live.
  const evidence = new Map<string, unknown>();
  const judge = jsonJudge(new FakeProvider({ scripts: [{ claim_0: 0.1 }] }), async (name, body) => {
    // A real test runner could attach this JSON to its report here.
    evidence.set(name, body);
  });
  const state = { message: "Something went wrong." };

  await assert.rejects(
    judge.expectClaims(async () => state, [{ claim: "The error message explains how to recover" }]),
    (error: unknown) => {
      assert.ok(error instanceof SemanticAssertionError);
      assert.equal(error.results[0]?.passed, false);
      assert.equal(error.results[0]?.probability, 0.1);
      return true;
    },
  );
  assert.ok(evidence.has("semantic-answers"));
  assert.deepEqual(evidence.get("semantic-state"), state);
});
