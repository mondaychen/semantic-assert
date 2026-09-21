---
title: Quick start
description: Run your first semantic assertion with TypeSafe, Vercel AI Gateway, or a scripted provider without an API key.
---

# Quick start

You'll write your first semantic assertion against a JSON response. The core judge
doesn't care which test runner you use, or whether you use one at all. For HTML,
continue with the [Playwright setup](./reference/playwright#install) afterwards.

::: info You will learn

- How to install the core package and a provider
- How to assert a plain-English claim about a JSON value
- How to switch to Vercel AI Gateway
- How to run the whole flow without an API key

:::

## Install

Use Node.js 22 or newer:

```sh
pnpm add semantic-assert semantic-assert-typesafe
export TYPESAFE_API_KEY="your-api-key"
```

The `semantic-assert-typesafe` package talks to [Jev](https://typesafe.ai),
TypeSafe's System One model. Jev returns typed answers and calibrated probabilities
to yes/no and multiple-choice questions instead of generating text, so you can
compare its probabilities with a threshold directly. Get an API key from TypeSafe,
or skip ahead to [try the flow without one](#try-the-flow-without-an-api-key).

## Make your first assertion

Create a judge with a provider and a threshold, then hand it a capture function
and a claim. Save this as `check.mjs`:

```js
import { Judge, resolveJudgeSettings } from "semantic-assert";
import { typesafe } from "semantic-assert-typesafe";

const judge = new Judge({
  provider: typesafe(),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
});

await judge.expectClaims(
  async () => ({ message: "Your changes have been saved." }),
  [{ claim: "The message confirms success" }],
);

console.log("Semantic assertion passed.");
```

Run it:

```sh
node check.mjs
```

The capture function returns the state to judge. The judge sends that state and
your claim to the provider in one request, and resolves when the probability that
the claim holds is at least `0.8`. Otherwise it throws a `SemanticAssertionError`
that lists every claim with its probability.

::: tip Keys in a `.env` file
The provider doesn't load `.env` on its own. Run `node --env-file=.env check.mjs`,
and keep keys in your test or server environment.
:::

### Why does it evaluate only once?

The judge evaluates once by default (`timeoutMs: 0`). Asking the model the same
question about the same response again costs a request and adds no evidence. Set a
positive timeout only when the state you capture actually changes between checks,
and you want the judge to recapture it and try again.

## Use Vercel AI Gateway

Install the adapter and its AI SDK peer dependency:

```sh
pnpm add semantic-assert semantic-assert-ai-sdk ai@7.0.107
export AI_GATEWAY_API_KEY="your-api-key"
```

Swap the provider in the example above:

```ts
import { aiSdk } from "semantic-assert-ai-sdk";

const judge = new Judge({
  provider: aiSdk(),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
});
```

This adapter defaults to `typesafe-ai/jev`, so you're still using Jev, routed
through [Vercel AI Gateway](https://vercel.com/ai-gateway). See [providers](./reference/providers) for timeout,
retry, and cost settings.

## Try the flow without an API key

You only need the core package:

```sh
pnpm add semantic-assert
```

Use `FakeProvider` to script the scores the judge receives:

```ts
import { FakeProvider, Judge, resolveJudgeSettings } from "semantic-assert";

const judge = new Judge({
  provider: new FakeProvider({ scripts: [{ claim_0: 0.95 }] }),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
});

await judge.expectClaims(
  async () => ({ message: "Your changes have been saved." }),
  [{ claim: "The message confirms success" }],
);
```

::: warning Pitfall
`FakeProvider` returns the scores you script. It exercises the assertion flow, but
it never reads the content. A passing fake assertion doesn't tell you the claim is
true. Use a live provider to check the meaning of real text.
:::

## Recap

- A judge is a provider plus settings. The threshold is the pass mark for every claim that doesn't set its own.
- `expectClaims` takes a capture function and a list of claims, sends them in one request, and throws when a claim misses.
- The default is one evaluation. Polling is opt-in through a positive `timeoutMs`.
- `FakeProvider` scripts scores for tests of the flow itself.

## Next steps

- [HTML alerts and copy changes](./examples/html-alerts): test user-facing messages after a PM edits the wording.
- [Generated support replies](./examples/generated-replies): test a promise that a keyword check misses.
- [Core assertions](./reference/core): batch claims, poll changing state, and inspect failures.
