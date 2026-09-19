import { setTimeout } from "node:timers/promises";
import {
  FakeProvider,
  type FakeProviderOptions,
  type Provider,
  type Questions,
  type JsonValue,
} from "semantic-assert";
import { typesafe } from "semantic-assert-typesafe";
import { aiSdk } from "semantic-assert-ai-sdk";
import { requestDelayMs, singlePass } from "./timing.js";

function paced(provider: Provider): Provider {
  if (requestDelayMs === 0) return provider;
  return {
    name: provider.name,
    async evaluate<Q extends Questions>(state: JsonValue, questions: Q) {
      // Waiting before every call also covers new test processes and polling.
      console.log(`Waiting ${requestDelayMs / 1_000}s before the next ${provider.name} request…`);
      await setTimeout(requestDelayMs);
      return provider.evaluate(state, questions);
    },
  };
}

// Live requests are opt-in, even when an API key is already in the environment.
export function exampleProvider(fake: FakeProviderOptions): Provider {
  const mode = process.env.EXAMPLE_PROVIDER ?? "fake";
  if (mode === "fake") return new FakeProvider(fake);
  if (mode === "ai-sdk") {
    if (!process.env.AI_GATEWAY_API_KEY) {
      throw new Error("Set AI_GATEWAY_API_KEY before using EXAMPLE_PROVIDER=ai-sdk");
    }
    // Smoke and paced runs do not spend extra requests on SDK retries.
    return paced(aiSdk({ maxRetries: singlePass || requestDelayMs > 0 ? 0 : undefined }));
  }
  if (mode !== "typesafe") throw new Error("EXAMPLE_PROVIDER must be fake, typesafe, or ai-sdk");
  if (!process.env.TYPESAFE_API_KEY) {
    throw new Error("Set TYPESAFE_API_KEY before using EXAMPLE_PROVIDER=typesafe");
  }
  return paced(typesafe({ maxRetries: singlePass || requestDelayMs > 0 ? 0 : undefined }));
}
