# Rejected and unresolved findings

Commit: 395cf7145fe28122f5a69026b310e02df114f907  |  run-id: 2be86e38745c0256

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-001 - Subcommand signal listeners and runningCommand handle never cleared on repeated execute

**Claim:** _executeSubCommand adds 5 process signal forwarders closing over the new child proc on every call and overwrites this.runningCommand without removing prior listeners or clearing the prior handle, so repeated calls accumulate listeners and leak the previous proc reference.

**Reason:** citation range expects 11 non-blank lines but snippet has 12

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
