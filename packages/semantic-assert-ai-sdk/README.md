# semantic-assert-ai-sdk

[Vercel AI SDK](https://ai-sdk.dev/)'s typed evaluation API as a provider for
`semantic-assert`. Defaults to [Jev on AI Gateway](https://vercel.com/ai-gateway/models/jev)
(`typesafe-ai/jev`) and reads `AI_GATEWAY_API_KEY` from the environment.

```ts
import { Judge, noul, resolveJudgeSettings } from "semantic-assert";
import { aiSdk } from "semantic-assert-ai-sdk";

const judge = new Judge({
  provider: aiSdk(),
  settings: resolveJudgeSettings(),
  hooks: { wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
});

const { answers } = await judge.evaluate(
  { reply: "Please send a photo of the damage so we can help." },
  { actionable: noul("Does the reply give the customer a concrete next step?") },
);
console.log(answers.actionable.noul);
```

Use `aiSdk()` anywhere a `Provider` is accepted, including Playwright's
`judgeProvider` fixture and `createJudgeExpect`. For `expectClaims` over arbitrary
JSON, supply a suitable claim template as in the [JSON examples](../../examples/support/json-judge.ts).
The core's default templates describe captured web pages.

## Configuration

```ts
const provider = aiSdk({
  model: "typesafe-ai/jev",
  gateway: {
    apiKey: process.env.AI_GATEWAY_API_KEY,
    // Also accepts baseURL, headers, and fetch for custom transports.
  },
  timeoutMs: 10_000,
  maxRetries: 2,
  providerOptions: { gateway: { zeroDataRetention: true } },
});
```

String model IDs are resolved explicitly through `createGateway().evaluationModel`.
You can instead pass any compatible AI SDK evaluation model instance as `model`;
its own authentication and transport apply, and `gateway` options are unused.
Chat/language model instances are not evaluation models.

Credentials are resolved when a request is made, so the factory can be called in
module-level fixture definitions. Keep keys server-side. The package does not load
`.env` automatically; use your runner's environment loader or Node's `--env-file`.

The SDK owns retry policy (two retries by default). `timeoutMs` bounds the entire
evaluation, including retries, and `abortSignal` can cancel it earlier. SDK errors
propagate, including authentication, account-verification, and invalid-response
errors. No fallback to the direct TypeSafe endpoint occurs.

## Mapping and metrics

- All questions share one SDK `experimental_evaluate` call.
- Core `noul` questions map to SDK `boolean`; `probability` maps back to `noul`
  unchanged, including probabilities close to zero.
- Choice option names and distributions are preserved. The SDK does not expose
  TypeSafe's native `confidence`; this adapter uses the selected option's
  probability as `confidence`. Calibrate Choice thresholds when switching from
  the direct TypeSafe provider. Missing distributions are rejected rather than
  filled with synthetic certainty.
- Top-level `null`, numbers, and booleans in state or instructions are encoded as
  JSON text to fit the SDK's string/object/array input contract. Nested values
  retain their original types.
- The returned model is the SDK response model ID. Gateway currently identifies
  the requested route, which may be an alias rather than a versioned upstream model.
- Usage and SDK evaluation attempts are recorded. Missing token counts use zero
  when the other count is present; completely absent usage is omitted. Internal
  Gateway routing attempts are not included in the SDK attempt count.
- Cost is unknown by default. To estimate it from your configured rates, set
  `pricing: { inputUsdPerMtok, outputUsdPerMtok }`. Both rates and both token
  counts are required; this is an estimate, not the Gateway invoice.

The AI SDK evaluation API is experimental and can change in patch releases. This
package pins `ai` to the version exercised by its tests (7.0.107).

## Examples and checks

```sh
EXAMPLE_PROVIDER=ai-sdk pnpm examples:core
EXAMPLE_PROVIDER=ai-sdk pnpm examples:playwright
pnpm --filter semantic-assert-ai-sdk test
```

The example commands run from the repository root with `AI_GATEWAY_API_KEY`
already set. See the [examples guide](../../examples/README.md) for `.env` commands.
Unit tests use the real SDK with mocked evaluation models or HTTP responses and
never need a key.
