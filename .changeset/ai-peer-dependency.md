---
"semantic-assert-ai-sdk": minor
---

`ai` is now a peer dependency (`>=7.0.107 <8`) instead of a pinned runtime dependency, so projects share one copy of the SDK and evaluation model instances passed as `model` type-check against it. Install `ai` alongside this package.
