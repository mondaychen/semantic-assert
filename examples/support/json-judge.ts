import { setTimeout } from "node:timers/promises";
import {
  Judge,
  choice,
  noul,
  resolveJudgeSettings,
  type JudgeHooks,
  type Provider,
} from "semantic-assert";

export function jsonJudge(provider: Provider, attach?: JudgeHooks["attach"]): Judge {
  return new Judge({
    provider,
    settings: resolveJudgeSettings({
      threshold: 0.8,
      timeoutMs: 5_000,
      pollIntervalMs: 25,
      // The built-in templates describe web pages. These describe arbitrary JSON.
      templates: {
        pageClaim: (claim) =>
          noul({
            statement: claim,
            question:
              "Is the statement supported by the supplied JSON state? Use only that state as evidence.",
          }),
        classification: (instructions, criteria) =>
          choice(
            {
              question: instructions,
              note: "Classify using only the supplied JSON state.",
            },
            criteria,
          ),
      },
    }),
    hooks: {
      wait: async (ms) => {
        await setTimeout(ms);
      },
      attach,
    },
  });
}
