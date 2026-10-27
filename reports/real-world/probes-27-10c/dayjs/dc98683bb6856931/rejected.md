# Rejected and unresolved findings

Commit: 436bde0bcded312781cbe45dc2b0ef079a36d8e3  |  run-id: dc98683bb6856931

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

_None this run._
## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

### F-005 - Hour-only UTC offset parses to NaN

**Claim:** offsetFromString does not default missing minutes, so hour-only offsets like +02 produce NaN instead of 120 minutes.

### F-006 - Millisecond fraction not scaled to milliseconds

**Claim:** Fractional seconds are truncated to 3 chars without scaling, so .5 becomes 5ms instead of 500ms and .56 becomes 56ms instead of 560ms.


## Refuted

_None this run._
## Uncertain

_None this run._
