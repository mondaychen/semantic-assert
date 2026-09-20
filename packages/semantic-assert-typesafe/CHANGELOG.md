# semantic-assert-typesafe

## 0.2.1

### Patch Changes

- Updated dependencies [597a5bb]
  - semantic-assert@0.3.0

## 0.2.0

### Minor Changes

- 376e6b9: The TypeSafe provider no longer estimates cost from a built-in price. Set `usdPerMtokInput` or `TYPESAFE_USD_PER_MTOK_INPUT` to your current rate to get per-call estimates; otherwise cost is reported as unknown, matching the AI SDK provider. `DEFAULT_USD_PER_MTOK_INPUT` is removed. The usage report header now describes cost as an estimate from configured rates.

### Patch Changes

- 53eb645: `JevClient.systemOne` now returns `attempts` on its result, and `TypeSafeProvider` reports it from there instead of from instance state. Overlapping `evaluate` calls could previously report each other's retry counts.
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

- 32eb19f: Use the official TypeSafe SDK for System One requests while preserving the provider
  API, retry policy, HTTP error facade, and usage metrics. Connection and timeout
  failures now use SDK error types; timeouts also cover response-body delivery.
