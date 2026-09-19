# semantic-assert-ai-sdk

## 0.2.0

### Minor Changes

- b9efffe: `ai` is now a peer dependency (`>=7.0.107 <8`) instead of a pinned runtime dependency, so projects share one copy of the SDK and evaluation model instances passed as `model` type-check against it. Install `ai` alongside this package.

### Patch Changes

- d48a364: Add a Vercel AI SDK evaluation provider, defaulting to Jev through AI Gateway.
  Map typed Boolean and Choice answers into semantic-assert results, preserve SDK
  retries and cancellation, and report token usage, attempts, and optional cost
  estimates. Include runnable examples, documentation, and package-consumer checks.
  Provide a serial live-example runner with optional pauses between requests,
  disabled by default.
- Updated dependencies [e1d6548]
- Updated dependencies [376e6b9]
- Updated dependencies [0704f2c]
- Updated dependencies [0752411]
- Updated dependencies [aafeef5]
- Updated dependencies [c37322c]
- Updated dependencies [c5aa695]
- Updated dependencies [f703a72]
  - semantic-assert@0.2.0
