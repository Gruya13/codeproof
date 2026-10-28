# Rejected and unresolved findings

Commit: b2c8f4c90801b6c2260a43ce7550c22868a0fb82  |  run-id: 6b5d53539cefbcd5

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-008 - scheduler start leaks prior interval

**Claim:** start() overwrites this.timer with a new setInterval without clearing the existing handle, leaking the prior interval on repeated start.

**Reason:** citation range expects 11 non-blank lines but snippet has 12

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
