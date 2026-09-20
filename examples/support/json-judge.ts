import { Judge, resolveJudgeSettings, type JudgeHooks, type Provider } from "semantic-assert";

export function jsonJudge(provider: Provider, attach?: JudgeHooks["attach"]): Judge {
  return new Judge({
    provider,
    settings: resolveJudgeSettings({
      threshold: 0.8,
      pollIntervalMs: 25,
      // The built-in templates already describe arbitrary JSON state.
    }),
    hooks: { attach },
  });
}
