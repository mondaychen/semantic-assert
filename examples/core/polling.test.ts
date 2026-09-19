import assert from "node:assert/strict";
import { test } from "node:test";
import { NotReadyError } from "semantic-assert";
import { exampleProvider } from "../support/provider.js";
import { jsonJudge } from "../support/json-judge.js";

test("wait for a background export to offer a download", async () => {
  const judge = jsonJudge(
    exampleProvider({
      scripts: [{ claim_0: 0.05 }, { claim_0: 0.99 }],
    }),
  );
  let captures = 0;

  await judge.expectClaims(async () => {
    // A deterministic stand-in for fetching a changing job status from an API.
    captures += 1;
    if (captures === 1) throw new NotReadyError("The export job is not visible yet");
    if (captures === 2) return { message: "Preparing your export. Please wait.", download: null };
    return { message: "Your export is ready. Download the CSV.", download: "/exports/report.csv" };
  }, [{ claim: "The export is ready and the user is offered a download" }]);

  // NotReadyError skips the provider call; later polls capture fresh state.
  assert.ok(captures >= 2);
  assert.equal(judge.metrics.totals.calls, captures - 1);
});
