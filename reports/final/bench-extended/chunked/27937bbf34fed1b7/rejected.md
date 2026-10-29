# Rejected and unresolved findings

Commit: b2c8f4c90801b6c2260a43ce7550c22868a0fb82  |  run-id: 27937bbf34fed1b7

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-005 - throttle timer invokes stale args instead of lastArgs

**Claim:** throttle's delayed timer invokes the args captured when the timer was created, not the latest lastArgs, so intermediate calls updating lastArgs are ignored and stale arguments are delivered.

**Reason:** citation range expects 12 non-blank lines but snippet has 11

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
