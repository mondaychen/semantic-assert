---
title: Quick start
description: Run your first semantic assertion with TypeSafe, AI Gateway, or a scripted provider without an API key.
---

# Quick start

Start with a JSON response. The core judge works independently of your test runner.
For HTML, follow the [Playwright setup](./reference/playwright#install).

## Install

Use Node.js 22 or newer.

```sh
pnpm add semantic-assert semantic-assert-typesafe
export TYPESAFE_API_KEY="your-api-key"
```

The `semantic-assert-typesafe` package talks to [Jev](https://typesafe.ai),
TypeSafe's System One model. Jev returns typed answers and calibrated
probabilities to yes/no and multiple-choice questions instead of generating text,
so the probabilities below can be compared with a threshold directly. Get an API
key from TypeSafe, or skip ahead to
[try the flow without one](#try-the-flow-without-an-api-key).

## Make your first assertion

Save this as `check.mjs`:

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

If your key is in `.env`, use `node --env-file=.env check.mjs`. The provider does
not load that file automatically. Keep keys in your test or server environment.

The judge evaluates once by default (`timeoutMs: 0`). Polling an unchanged response
would add requests without new evidence. Set a positive timeout only when you
want to recapture changing state and try again.

## Use AI Gateway

Install the adapter and its AI SDK peer dependency:

```sh
pnpm add semantic-assert semantic-assert-ai-sdk ai@7.0.107
export AI_GATEWAY_API_KEY="your-api-key"
```

Replace the TypeSafe import and provider in the example:

```ts
import { aiSdk } from "semantic-assert-ai-sdk";

const judge = new Judge({
  provider: aiSdk(),
  settings: resolveJudgeSettings({ threshold: 0.8 }),
});
```

This adapter defaults to `typesafe-ai/jev`. See [providers](./reference/providers)
for timeout, retry, and cost settings.

## Try the flow without an API key

Only the core package is needed:

```sh
pnpm add semantic-assert
```

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

`FakeProvider` returns scripted scores. It exercises the assertion flow but does
not evaluate language. Use a live provider to check the meaning of real content.

## Next steps

- [HTML alerts and copy changes](./examples/html-alerts): test user-facing messages after a PM edits the wording.
- [Generated support replies](./examples/generated-replies): test a promise that a keyword check misses.
- [Core assertions](./reference/core): batch claims, poll changing state, and inspect failures.
