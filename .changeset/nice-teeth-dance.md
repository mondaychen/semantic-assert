---
"semantic-assert-ai-sdk": patch
---

Add a Vercel AI SDK evaluation provider, defaulting to Jev through AI Gateway.
Map typed Boolean and Choice answers into semantic-assert results, preserve SDK
retries and cancellation, and report token usage, attempts, and optional cost
estimates. Include runnable examples, documentation, and package-consumer checks.
Provide a serial live-example runner with optional pauses between requests,
disabled by default.
