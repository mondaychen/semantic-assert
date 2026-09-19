---
"semantic-assert-playwright": patch
---

The usage reporter now merges every attempt of a retried test into one scenario row, summing the calls and keeping the final status. Retries previously produced duplicate rows and inflated the scenario count.
