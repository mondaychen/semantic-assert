---
"semantic-assert-playwright": patch
---

A `region` that matches more than one element now fails immediately with a message naming the match count, instead of surfacing Playwright's strict-mode error from `ariaSnapshot`.
