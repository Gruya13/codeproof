# Rejected and unresolved findings

Commit: b2c8f4c90801b6c2260a43ce7550c22868a0fb82  |  run-id: 9b6c312a5ff5fb74

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-007 - scheduler start replaces timer without clear

**Claim:** createScheduler.start overwrites this.timer with a new interval without clearing an existing interval, leaking the prior handle on repeated start.

**Reason:** citation range expects 10 non-blank lines but snippet has 9

### F-009 - throttle replays stale args

**Claim:** throttle timer callback invokes the first call's args instead of the latest lastArgs, so coalesced calls report stale arguments.

**Reason:** citation range expects 9 non-blank lines but snippet has 8

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
