// Fake examples stay fast, even when the caller has configured a live-run delay.
const isLive = ["ai-sdk", "typesafe"].includes(process.env.EXAMPLE_PROVIDER ?? "fake");
const delay = Number(process.env.EXAMPLE_REQUEST_DELAY_MS ?? 0);
if (!Number.isSafeInteger(delay) || delay < 0 || delay > 300_000) {
  throw new Error("EXAMPLE_REQUEST_DELAY_MS must be an integer between 0 and 300000");
}

export const requestDelayMs = isLive ? delay : 0;
// Allow several paced polls before concluding that changing state did not settle.
export const judgeTimeoutMs = 5_000 + 3 * requestDelayMs;
export const testTimeoutMs = 60_000 + 6 * requestDelayMs;
