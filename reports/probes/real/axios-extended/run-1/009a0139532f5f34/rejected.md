# Rejected and unresolved findings

Commit: b2c8f4c90801b6c2260a43ce7550c22868a0fb82  |  run-id: 009a0139532f5f34

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-002 - settle bypasses validateStatus for status <500

**Claim:** settle resolves any response with status <500 even when validateStatus returns false, so 4xx failures are incorrectly resolved.

**Reason:** citation range expects 5 non-blank lines but snippet has 4

### F-006 - buildURL off-by-one keeps hash

**Claim:** buildURL keeps the '#' when stripping the fragment, so serialized params are appended after '#' inside the fragment instead of as query.

**Reason:** citation range expects 8 non-blank lines but snippet has 7

### F-007 - Scheduler interval handle replaced without clear

**Claim:** start() overwrites this.timer with a new interval without clearing an existing interval, leaking the prior timer.

**Reason:** citation range expects 11 non-blank lines but snippet has 12

### F-008 - throttle trailing timeout uses stale args

**Claim:** Throttled trailing call captures the first args in the timeout closure instead of lastArgs, so intermediate updates are lost and stale args are invoked.

**Reason:** citation range expects 15 non-blank lines but snippet has 12

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
