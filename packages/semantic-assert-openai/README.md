# semantic-assert-openai

OpenAI's [Decisions API](https://developers.openai.com/api/docs/guides/decisions)
as a provider for `semantic-assert`. Decisions returns typed answers with
probabilities instead of generated text, so claims map onto its `predicate`
questions and classifications onto its `choice` questions.

```ts
import { openaiDecisions } from "semantic-assert-openai";

const provider = openaiDecisions({
  // apiKey defaults to OPENAI_API_KEY; baseUrl to OPENAI_BASE_URL;
  // organization and project to OPENAI_ORG_ID and OPENAI_PROJECT_ID.
  model: "gpt-6-luna", // the default, and the only model Decisions supports at launch
  usdPerMtokInput: 0.1, // or OPENAI_DECISIONS_USD_PER_MTOK_INPUT
});
```

The Decisions API is in public beta. If your organization doesn't have access yet,
requests fail with HTTP 403.

Requests use the official [`openai`](https://www.npmjs.com/package/openai) SDK,
version 7.30.0 or newer. The SDK owns retries: two by default, for connection
errors, 408, 409, 429, and 5xx responses, honoring `retry-after`. `timeoutMs`
(default 10 s) applies per attempt. Each result reports how many attempts the call
took, even when calls overlap. API failures surface as the SDK's `APIError` types.

How questions are sent:

- State becomes the request's text `input`. Strings pass through, and anything else is sent as compact JSON.
- Object instructions are sent as compact JSON.
- A claim's `true` and `false` criteria join its instructions as `true_when` and `false_when` fields, because predicates have no criteria field.
- Choice criteria become `choices`, with each criterion as the option's `description`.
- If the model declines a question, the call throws a `DecisionRefusalError` naming the declined questions. It never guesses an answer.

Cost is unknown by default. Set `usdPerMtokInput` (or
`OPENAI_DECISIONS_USD_PER_MTOK_INPUT`) to your current rate and the provider
estimates each call's cost from input tokens, because Decisions bills input tokens
only. OpenAI listed `gpt-6-luna` at $0.10 per million input tokens on 2026-10-07,
before regional and long-context premiums. The estimate is not an invoice.

Probabilities from `gpt-6-luna` aren't on the same scale as Jev's. Calibrate your
thresholds on your own good and bad examples before you switch providers.

Keep the API key server-side. Never build this into a browser bundle.

```bash
pnpm --filter semantic-assert-openai test
```
