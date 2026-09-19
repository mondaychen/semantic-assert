---
"semantic-assert-typesafe": patch
---

Use the official TypeSafe SDK for System One requests while preserving the provider
API, retry policy, HTTP error facade, and usage metrics. Connection and timeout
failures now use SDK error types; timeouts also cover response-body delivery.
