import { Judge, resolveJudgeSettings, type JudgeHooks, type Provider } from "semantic-assert";
import { judgeTimeoutMs } from "./timing.js";

export function jsonJudge(provider: Provider, attach?: JudgeHooks["attach"]): Judge {
  return new Judge({
    provider,
    settings: resolveJudgeSettings({
      threshold: 0.8,
      timeoutMs: judgeTimeoutMs,
      pollIntervalMs: 25,
      // The built-in templates already describe arbitrary JSON state.
    }),
    hooks: { attach },
  });
}
