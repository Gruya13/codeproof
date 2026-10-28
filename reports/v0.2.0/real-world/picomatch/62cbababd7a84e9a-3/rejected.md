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

### F-002 - tokens last-segment check uses falsy index

**Claim:** Last-token update uses truthiness of prevIndex, so when the last slash is at index 0 (e.g. "/foo") prevIndex 0 is falsy and the final token value/depth is never assigned.

**Verifier:** uncertain - verifier output was not parseable JSON (empty model output), finish_reason=length

