---
"semantic-assert": minor
"semantic-assert-playwright": minor
---

The core's default question templates now describe arbitrary JSON state instead of a captured web page, and `JudgeTemplates.pageClaim` is renamed to `claim`. The page-specific wording moves to `semantic-assert-playwright` as `pageTemplates`, which `PageJudge` applies automatically. Core users judging API responses no longer need to override templates.
