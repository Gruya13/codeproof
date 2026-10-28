# Rejected and unresolved findings

Commit: b2c8f4c90801b6c2260a43ce7550c22868a0fb82  |  run-id: 6b5d53539cefbcd5

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-002 - settle ignores validateStatus for status <500

**Claim:** settle resolves any status <500 even when validateStatus returns false, so custom validateStatus can never reject 4xx.

**Reason:** citation range expects 5 non-blank lines but snippet has 4

### F-007 - scheduler start leaks prior interval

**Claim:** createScheduler.start replaces this.timer with a new interval without clearing an existing interval, leaking the prior handle on repeated start.

**Reason:** citation range expects 10 non-blank lines but snippet has 9

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
