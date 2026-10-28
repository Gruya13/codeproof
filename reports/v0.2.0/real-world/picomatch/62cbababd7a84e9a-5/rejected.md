# Rejected and unresolved findings

Commit: 6bb40679c218cefba5d4e9662408c5fdf699a8bb  |  run-id: 62cbababd7a84e9a

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

_None this run._
## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

### F-001 - Tokens last value skipped due to falsy prevIndex check

**Claim:** Last segment token value is never assigned when there are no slashes or when the first slash is at index 0, because prevIndex (0 or undefined) is tested for truthiness instead of definedness.

**Verifier:** uncertain - verifier output was not parseable JSON (empty model output), finish_reason=length

### F-003 - Prefix handling discards first segment token value

**Claim:** When start != 0 the first slash token value is overwritten with prefix, discarding the first path segment value from tokens.

**Verifier:** uncertain - verifier output was not parseable JSON (empty model output), finish_reason=length

