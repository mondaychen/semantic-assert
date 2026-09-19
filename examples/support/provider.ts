import { FakeProvider, type FakeProviderOptions, type Provider } from "semantic-assert";
import { typesafe } from "semantic-assert-typesafe";

// Live requests are opt-in, even when an API key is already in the environment.
export function exampleProvider(fake: FakeProviderOptions): Provider {
  const mode = process.env.EXAMPLE_PROVIDER ?? "fake";
  if (mode === "fake") return new FakeProvider(fake);
  if (mode !== "typesafe") throw new Error("EXAMPLE_PROVIDER must be fake or typesafe");
  if (!process.env.TYPESAFE_API_KEY) {
    throw new Error("Set TYPESAFE_API_KEY before using EXAMPLE_PROVIDER=typesafe");
  }
  return typesafe();
}
