# Rejected and unresolved findings

Commit: b2c8f4c90801b6c2260a43ce7550c22868a0fb82  |  run-id: f0b6d3c2b5e351ae

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-002 - settle OR with status<500 bypasses validateStatus

**Claim:** settle resolves any response with status <500 even when validateStatus returns false, so 4xx errors incorrectly resolve instead of rejecting.

**Reason:** citation range expects 5 non-blank lines but snippet has 4

### F-003 - spread does not expand array arguments

**Claim:** spread wraps array as single argument [arr] instead of spreading arr, so f(x,y,z) receives the whole array as x.

**Reason:** citation range expects 5 non-blank lines but snippet has 4

### F-004 - combineURLs missing slash separator

**Claim:** combineURLs strips trailing slashes from base and leading slashes from relative then concatenates without inserting '/', producing e.g. base+relative without separator.

**Reason:** citation range expects 13 non-blank lines but snippet has 12

### F-006 - buildURL appends query after hash fragment

**Claim:** buildURL keeps '#' via slice(0,hashmarkIndex+1) then appends query after fragment, placing serialized params inside fragment instead of query string.

**Reason:** citation range expects 8 non-blank lines but snippet has 7

### F-007 - throttle replays stale args instead of lastArgs

**Claim:** throttle timer callback invokes stale closure args instead of lastArgs, so coalesced calls report first args rather than latest.

**Reason:** citation range expects 15 non-blank lines but snippet has 12

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
