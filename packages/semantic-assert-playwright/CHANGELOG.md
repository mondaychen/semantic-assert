# semantic-assert-playwright

## 0.2.0

### Minor Changes

- c37322c: The core's default question templates now describe arbitrary JSON state instead of a captured web page, and `JudgeTemplates.pageClaim` is renamed to `claim`. The page-specific wording moves to `semantic-assert-playwright` as `pageTemplates`, which `PageJudge` applies automatically. Core users judging API responses no longer need to override templates.
- c794c5d: Remove the unused `PageJudge.memory` map. Pass values between steps with `extraState`, which puts them in front of the model by name.

### Patch Changes

- a845ff6: A `region` that matches more than one element now fails immediately with a message naming the match count, instead of surfacing Playwright's strict-mode error from `ariaSnapshot`.
- fbed0b2: `toSatisfy` and `toSatisfyAll` now throw when used with `.not` instead of silently inverting the result. Use `{ claim, expected: false }` for negative claims.
- f703a72: The judge now records provider calls that throw, so a scenario that spends retries and then fails still shows its call count and wait time. `UsageTotals` gains `failedCalls`, `CallMetrics` gains an optional `failed` flag, and the usage table gains a "Failed" column. The reporter leaves failed calls out of the models list.
- 9360cc3: The usage reporter now merges every attempt of a retried test into one scenario row, summing the calls and keeping the final status. Retries previously produced duplicate rows and inflated the scenario count.
- 651b3ef: `includeLinks` now collects links from the captured `region` only. Previously every link on the page was sent even when the snapshot was scoped, which bypassed the region boundary users rely on for redaction.
- Updated dependencies [e1d6548]
- Updated dependencies [376e6b9]
- Updated dependencies [0704f2c]
- Updated dependencies [0752411]
- Updated dependencies [aafeef5]
- Updated dependencies [c37322c]
- Updated dependencies [c5aa695]
- Updated dependencies [f703a72]
  - semantic-assert@0.2.0

## 0.1.0

Initial release.
