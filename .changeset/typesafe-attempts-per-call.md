---
"semantic-assert-typesafe": patch
---

`JevClient.systemOne` now returns `attempts` on its result, and `TypeSafeProvider` reports it from there instead of from instance state. Overlapping `evaluate` calls could previously report each other's retry counts.
