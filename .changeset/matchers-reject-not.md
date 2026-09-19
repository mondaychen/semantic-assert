---
"semantic-assert-playwright": patch
---

`toSatisfy` and `toSatisfyAll` now throw when used with `.not` instead of silently inverting the result. Use `{ claim, expected: false }` for negative claims.
