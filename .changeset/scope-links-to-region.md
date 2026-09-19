---
"semantic-assert-playwright": patch
---

`includeLinks` now collects links from the captured `region` only. Previously every link on the page was sent even when the snapshot was scoped, which bypassed the region boundary users rely on for redaction.
