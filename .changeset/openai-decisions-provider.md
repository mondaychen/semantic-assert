---
"semantic-assert-openai": minor
---

New package: OpenAI's Decisions API as a semantic-assert provider. `openaiDecisions()` sends claims as `predicate` questions and classifications as `choice` questions to `gpt-6-luna` through the official `openai` SDK, reports per-call attempts and token usage, estimates cost from `usdPerMtokInput` or `OPENAI_DECISIONS_USD_PER_MTOK_INPUT`, and throws `DecisionRefusalError` when the model declines a question.
