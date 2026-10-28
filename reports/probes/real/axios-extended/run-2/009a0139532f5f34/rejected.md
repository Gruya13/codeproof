# Rejected and unresolved findings

Commit: b2c8f4c90801b6c2260a43ce7550c22868a0fb82  |  run-id: 009a0139532f5f34

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-007 - scheduler start replaces interval without clearing

**Claim:** createScheduler.start overwrites this.timer without clearing existing interval, leaking prior interval on repeated start

**Reason:** citation range expects 10 non-blank lines but snippet has 9

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
