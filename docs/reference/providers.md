---
title: Providers & configuration
description: Choose TypeSafe, AI Gateway, or a fake provider and configure thresholds, timeouts, retries, and usage estimates.
---

# Providers & configuration

The same core judge and Playwright adapter accept any implementation of the
`Provider` interface.

| Package                      | Role                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| `semantic-assert`            | Core judge, settings, metrics, and scripted `FakeProvider`       |
| `semantic-assert-typesafe`   | TypeSafe Jev provider                                            |
| `semantic-assert-ai-sdk`     | AI SDK evaluation provider, defaulting to Jev through AI Gateway |
| `semantic-assert-playwright` | Page capture, fixtures, matchers, and reporting                  |

## TypeSafe

```ts
import { typesafe } from "semantic-assert-typesafe";

const provider = typesafe({
  timeoutMs: 10_000,
  maxRetries: 0,
});
```

The API key defaults to `TYPESAFE_API_KEY`. The model defaults to
`TYPESAFE_DEFAULT_MODEL`, then `jev-latest`; the base URL can be set with
`TYPESAFE_BASE_URL`.

TypeSafe's `timeoutMs` is per attempt. The default is a 10-second timeout and
three retries. Lower the retry count, as above, or allow enough time in your test
runner. The adapter owns retries so they are not nested with SDK retries.

To estimate cost, set `usdPerMtokInput` or `TYPESAFE_USD_PER_MTOK_INPUT` to your
current rate. Cost is unknown by default.

## AI Gateway

```ts
import { aiSdk } from "semantic-assert-ai-sdk";

const provider = aiSdk({
  model: "typesafe-ai/jev",
  timeoutMs: 10_000,
  maxRetries: 0,
});
```

The default model is `typesafe-ai/jev`, and the default API key comes from
`AI_GATEWAY_API_KEY`. Keep the key server-side. This adapter requires an AI SDK
evaluation model; chat/language models are not interchangeable with it.

The SDK owns retries (two by default). Here, `timeoutMs` bounds the entire
evaluation, including retries. No automatic fallback to TypeSafe's direct
endpoint occurs.

The adapter requires `ai >=7.0.107 <8`. Its evaluation API is experimental;
`7.0.107` is the version tested by this repository. To estimate cost, set
`pricing: { inputUsdPerMtok, outputUsdPerMtok }` to your rates. Both rates and
both token counts are needed for an estimate.

## Fake provider

```ts
import { FakeProvider } from "semantic-assert";

const provider = new FakeProvider({
  scripts: [{ claim_0: 0.95, claim_1: 0.02 }],
});
```

Claims are numbered from zero in the order passed to `expectClaims` or `expectPage`.
The fake provider returns scripted answers and records requests. It does not judge
the input's meaning. Use it to test integration behavior without network calls.

## Judge settings

`resolveJudgeSettings(overrides)` uses explicit overrides first, then environment
variables, then built-in defaults.

| Setting          | Environment variable              | Default |
| ---------------- | --------------------------------- | ------- |
| `threshold`      | `SEMANTIC_ASSERT_THRESHOLD`       | `0.7`   |
| `timeoutMs`      | `SEMANTIC_ASSERT_TIMEOUT_MS`      | `15000` |
| `pollIntervalMs` | `SEMANTIC_ASSERT_POLL_MS`         | `1000`  |
| `maxStateChars`  | `SEMANTIC_ASSERT_MAX_STATE_CHARS` | `40000` |

Thresholds must be between `0.5` and `1`. Per-claim thresholds override a call's
threshold, which overrides the judge's setting.

The core templates describe arbitrary JSON. The Playwright adapter supplies
templates naming the captured page fields. Custom templates are supported for
different providers or languages.

## Calibrate before relying on the result

A threshold is an acceptance policy, not a guarantee of accuracy. Check it against
known good and bad examples from your application, and recalibrate when changing
providers or models. Provider probabilities need not be comparable.

For classification, the AI SDK adapter uses the chosen option's probability as
confidence, while the direct TypeSafe provider exposes its native confidence.
Recheck confidence thresholds when switching between them.
