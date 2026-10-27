# Rejected and unresolved findings

Commit: 1dbc37fd1ceab832fc7c90cad81b1091c95ba563  |  run-id: 12ffca4e627ee488

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-002 - withBase prefix check missing segment boundary

**Claim:** withBase treats any string prefix as already-based, so input '/api-foo' with base '/api' is incorrectly returned unchanged instead of being joined.

**Reason:** citation range expects 12 non-blank lines but snippet has 11

### F-003 - withQuery array merge appends instead of replacing existing params

**Claim:** When input URL already has a query string, array values are appended without deleting the existing key while scalar values use set, leaving stale values duplicated.

**Reason:** citation range expects 11 non-blank lines but snippet has 10

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
