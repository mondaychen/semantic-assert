# semantic-assert-typesafe

[TypeSafe](https://docs.typesafe.ai/) System One (Jev) as a provider for
`semantic-assert`. Jev returns calibrated probabilities in a few
hundred milliseconds, which is what the core's thresholds are designed around.

```ts
import { typesafe } from "semantic-assert-typesafe";

const provider = typesafe({
  // apiKey defaults to TYPESAFE_API_KEY; baseUrl to TYPESAFE_BASE_URL;
  // model to TYPESAFE_DEFAULT_MODEL, then jev-latest.
  usdPerMtokInput: 0.042, // or TYPESAFE_USD_PER_MTOK_INPUT
});
```

Cost is unknown by default. Set `usdPerMtokInput` (or `TYPESAFE_USD_PER_MTOK_INPUT`)
to your current rate and the provider estimates each call's cost from input
tokens, because Jev bills input tokens only. For reference, Jev 1.13 was listed at
$0.042 per million input tokens on 2026-09-17; check
[docs.typesafe.ai/models](https://docs.typesafe.ai/models) for the current price.
The estimate is not an invoice.

Requests use the official [`@typesafe-ai/sdk`](https://docs.typesafe.ai/sdk/javascript).
The `typesafe()` factory and its options are unchanged, including lazy API-key
validation, `baseUrl`, `model`, `timeoutMs`, `maxRetries`, and injectable `fetch`
and `sleep` functions. The exported `JevClient` remains a compatibility facade.

The facade owns retries (three by default) for HTTP 429/529, connection failures,
and timeouts, with exponential backoff. SDK retries are disabled to avoid nested
retries and preserve the sleeper hook. HTTP failures remain `JevApiError` values;
connection and timeout failures use the SDK's error types. Malformed successful
responses fail immediately. The SDK handles request construction, authentication,
and a per-attempt timeout covering both headers and response-body delivery.
Top-level numeric and boolean state or instructions are converted to JSON text
to fit the SDK's input types; values inside objects and arrays are preserved.

Keep the API key server-side. Never build this into a browser bundle.

```bash
pnpm --filter semantic-assert-typesafe test
```
