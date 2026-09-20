---
"semantic-assert": minor
"semantic-assert-playwright": minor
---

Change the default assertion polling timeout from 15,000 ms to 0. Core assertions,
classifications, Playwright fixtures, and semantic matchers now capture and
evaluate once by default. Provider request timeouts and retries are unchanged.

Wait for the target with Playwright's `locator.waitFor()` or `expect(locator).toBeVisible()`
before judging it. To retain polling, set a positive `timeoutMs` per call, in judge
settings, or through `SEMANTIC_ASSERT_TIMEOUT_MS`. Classification callers must
still assert the returned choice, including when it is outside `settled`.

A zero timeout also prevents retries when `pollIntervalMs` is zero.
