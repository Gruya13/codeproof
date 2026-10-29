# Rejected and unresolved findings

Commit: 328af2180b242472b5e0e2e87d8b5ca24e99bf57  |  run-id: ad5bfdbcd9ed17eb

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-008 - withinQuota excludes inclusive max boundary

**Claim:** withinQuota uses strict < while documented max is inclusive, so used+amount exactly equal to max is incorrectly rejected.

**Reason:** citation range expects 6 non-blank lines but snippet has 7

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
