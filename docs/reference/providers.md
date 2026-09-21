---
title: Providers & configuration
description: Choose TypeSafe, AI Gateway, or a fake provider and configure thresholds, timeouts, retries, and usage estimates.
---

# Providers & configuration

The judge and the Playwright adapter accept anything that implements the
`Provider` interface. Two providers ship with the project, plus a fake for testing
the flow itself.

| Package                      | Role                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| `semantic-assert`            | Core judge, settings, metrics, and scripted `FakeProvider`       |
| `semantic-assert-typesafe`   | TypeSafe Jev provider                                            |
| `semantic-assert-ai-sdk`     | AI SDK evaluation provider, defaulting to Jev through AI Gateway |
| `semantic-assert-playwright` | Page capture, fixtures, matchers, and reporting                  |

::: info You will learn

- What Jev is and how claims map onto its questions
- How to configure the TypeSafe and AI Gateway providers
- How to script a fake provider
- Which judge settings exist and where their defaults come from
- Why you should calibrate thresholds before trusting them

:::

## TypeSafe

[Jev](https://typesafe.ai) is TypeSafe's first
[System One model](https://docs.typesafe.ai/concepts/system-one). It answers narrow
questions about supplied state with typed results and calibrated probabilities
rather than generated text. Your claims become Jev **Noul** questions, which return
the probability that a statement holds. Your classifications become **Choice**
questions, which return a distribution over named options. This provider calls
TypeSafe's API directly:

```ts
import { typesafe } from "semantic-assert-typesafe";

const provider = typesafe({
  timeoutMs: 10_000,
  maxRetries: 0,
});
```

The API key defaults to `TYPESAFE_API_KEY`. The model defaults to
`TYPESAFE_DEFAULT_MODEL`, then `jev-latest`. Set `TYPESAFE_BASE_URL` to point at a
different endpoint.

`timeoutMs` here is per attempt. The defaults are a 10-second timeout and three
retries, so a slow provider can hold a test for a while. Lower the retry count, as
above, or give your test runner enough time. The adapter owns these retries, so
they don't nest with SDK retries.

To estimate cost, set `usdPerMtokInput` or `TYPESAFE_USD_PER_MTOK_INPUT` to your
current rate. Until you do, cost reports as unknown.

## AI Gateway

Use the AI SDK adapter to reach Jev through Vercel's AI Gateway:

```ts
import { aiSdk } from "semantic-assert-ai-sdk";

const provider = aiSdk({
  model: "typesafe-ai/jev",
  timeoutMs: 10_000,
  maxRetries: 0,
});
```

The default model is `typesafe-ai/jev` and the default key comes from
`AI_GATEWAY_API_KEY`. Keep that key server-side.

Two differences from the direct provider matter:

- **The SDK owns retries**, two by default. `timeoutMs` bounds the whole evaluation, retries included.
- **There's no fallback.** If the gateway fails, the adapter doesn't try TypeSafe's direct endpoint.

::: warning Pitfall
This adapter needs an AI SDK **evaluation** model. Chat and language models aren't
interchangeable with it, even through the same gateway.
:::

The adapter requires `ai >=7.0.107 <8`. The evaluation API is experimental, and
`7.0.107` is the version this repository tests against. To estimate cost, set
`pricing: { inputUsdPerMtok, outputUsdPerMtok }`. Both rates and both token counts
are needed before an estimate appears.

## Fake provider

Script the scores the judge receives:

```ts
import { FakeProvider } from "semantic-assert";

const provider = new FakeProvider({
  scripts: [{ claim_0: 0.95, claim_1: 0.02 }],
});
```

Claims are numbered from zero in the order you pass them to `expectClaims` or
`expectPage`. The fake returns your scripted answers and records every request it
receives, so you can assert on what would have been sent. It never reads the
input. Use it to test integration behavior without network calls.

## Judge settings

`resolveJudgeSettings(overrides)` takes your explicit overrides first, then
environment variables, then built-in defaults:

| Setting          | Environment variable              | Default |
| ---------------- | --------------------------------- | ------- |
| `threshold`      | `SEMANTIC_ASSERT_THRESHOLD`       | `0.7`   |
| `timeoutMs`      | `SEMANTIC_ASSERT_TIMEOUT_MS`      | `0`     |
| `pollIntervalMs` | `SEMANTIC_ASSERT_POLL_MS`         | `1000`  |
| `maxStateChars`  | `SEMANTIC_ASSERT_MAX_STATE_CHARS` | `40000` |

**Thresholds** must be between `0.5` and `1`. A per-claim threshold overrides the
call's threshold, which overrides the judge's setting.

**Timing** works in layers too. The zero default means one evaluation. A positive
`timeoutMs` turns on polling, and `pollIntervalMs` sets the pause between checks.
Per-call options override judge settings. Both values must be finite and
non-negative. Provider request retries are a separate setting: even a single
evaluation can retry a transient API failure through `maxRetries`.

**Templates** turn a claim into a provider question. The core templates describe
arbitrary JSON. The Playwright adapter supplies templates that name the captured
page's fields, which helps the model considerably. You can replace any template,
for example to change the wording or the language.

## Calibrate before you rely on the result

A threshold is an acceptance policy, not a guarantee of accuracy. Check it against
known good and bad examples from your own application, and recalibrate when you
change providers or models. Probabilities from different providers aren't on the
same scale.

::: warning Pitfall
For classification, the AI SDK adapter reports the chosen option's probability as
its confidence, while the direct TypeSafe provider exposes its native confidence.
Recheck any confidence threshold when you switch between them.
:::

## Recap

- Jev is the default judge, reached directly through TypeSafe or through AI Gateway.
- The two providers handle retries differently. Set timeouts with that in mind.
- `FakeProvider` scripts scores and records requests for tests of the flow.
- Settings resolve from overrides, then environment, then defaults.
- Calibrate thresholds on your own data before trusting a green run.
