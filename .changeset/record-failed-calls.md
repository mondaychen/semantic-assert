---
"semantic-assert": minor
"semantic-assert-playwright": patch
---

The judge now records provider calls that throw, so a scenario that spends retries and then fails still shows its call count and wait time. `UsageTotals` gains `failedCalls`, `CallMetrics` gains an optional `failed` flag, and the usage table gains a "Failed" column. The reporter leaves failed calls out of the models list.
