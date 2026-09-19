# semantic-assert

## 0.2.0

### Minor Changes

- e1d6548: `Judge.classify` (and `PageJudge.classifyPage`) accept a per-call `template` option, matching `expectClaims`, so classification wording can be changed without touching suite settings.
- 0704f2c: `Judge` hooks are optional. `wait` defaults to a timer, so a core judge needs only a provider and settings; Playwright's adapter still passes `page.waitForTimeout`.
- c37322c: The core's default question templates now describe arbitrary JSON state instead of a captured web page, and `JudgeTemplates.pageClaim` is renamed to `claim`. The page-specific wording moves to `semantic-assert-playwright` as `pageTemplates`, which `PageJudge` applies automatically. Core users judging API responses no longer need to override templates.
- f703a72: The judge now records provider calls that throw, so a scenario that spends retries and then fails still shows its call count and wait time. `UsageTotals` gains `failedCalls`, `CallMetrics` gains an optional `failed` flag, and the usage table gains a "Failed" column. The reporter leaves failed calls out of the models list.

### Patch Changes

- 376e6b9: The TypeSafe provider no longer estimates cost from a built-in price. Set `usdPerMtokInput` or `TYPESAFE_USD_PER_MTOK_INPUT` to your current rate to get per-call estimates; otherwise cost is reported as unknown, matching the AI SDK provider. `DEFAULT_USD_PER_MTOK_INPUT` is removed. The usage report header now describes cost as an estimate from configured rates.
- 0752411: `describeUrl` reports a repeated query key as a list of its values instead of keeping only the last one.
- aafeef5: `SemanticAssertionError` now reports its own class name in `error.name` instead of the pre-extraction `JevAssertionError`.
- c5aa695: `resolveJudgeSettings` no longer throws on runtimes without a `process` global; it falls back to the built-in defaults there, as the README already promised.

## 0.1.0

Initial release.
