---
"semantic-assert": patch
---

`resolveJudgeSettings` no longer throws on runtimes without a `process` global; it falls back to the built-in defaults there, as the README already promised.
