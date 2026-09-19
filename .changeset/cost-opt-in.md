---
"semantic-assert-typesafe": minor
"semantic-assert": patch
---

The TypeSafe provider no longer estimates cost from a built-in price. Set `usdPerMtokInput` or `TYPESAFE_USD_PER_MTOK_INPUT` to your current rate to get per-call estimates; otherwise cost is reported as unknown, matching the AI SDK provider. `DEFAULT_USD_PER_MTOK_INPUT` is removed. The usage report header now describes cost as an estimate from configured rates.
