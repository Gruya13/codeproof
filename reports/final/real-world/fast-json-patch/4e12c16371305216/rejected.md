# Rejected and unresolved findings

Commit: 9d313ac01916e525e9204074f06e5295edec491b  |  run-id: 4e12c16371305216

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-002 - getPath emits JSON pointer with trailing slash

**Claim:** getPath returns pointer with trailing slash because _getPathRecursive appends '/' and getPath prepends '/' without stripping it, producing e.g. "/a/b/" instead of "/a/b".

**Reason:** citation range expects 10 non-blank lines but snippet has 9

### F-003 - isInteger treats empty string as integer

**Claim:** isInteger returns true for empty string because zero-length input skips the digit loop and falls through to return true, misclassifying "" as an array index.

**Reason:** citation range expects 14 non-blank lines but snippet has 13

### F-004 - Array index truncated by double-bitwise-NOT

**Claim:** Array index conversion uses ~~key which truncates to 32-bit signed int, so indices >= 2147483648 wrap to negative/wrong values instead of the intended index.

**Reason:** citation range expects 8 non-blank lines but snippet has 7

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
