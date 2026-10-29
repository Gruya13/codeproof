# Rejected and unresolved findings

Commit: 961ceeefcc5186005466f2085aeb36f31b161e37  |  run-id: 86ed5667b2ec15cc

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-002 - Empty closing tag '>' is swallowed, state never leaves CLOSE_TAG

**Claim:** CLOSE_TAG with empty tagName and c=='>' falls into notMatch branch, only strictFails and stays in CLOSE_TAG instead of calling closeTag/resetting to TEXT, so the '>' is dropped and following text is misparsed as tagName.

**Reason:** citation range expects 14 non-blank lines but snippet has 13

### F-003 - Valueless attribute bypasses attrib() and xmlns object shape

**Claim:** Valueless attribute in ATTRIB_NAME_SAW_WHITE directly assigns string '' and emits immediately instead of calling attrib(), bypassing duplicate check and xmlns handling which expects object attributes and deferred attribList.

**Reason:** citation range expects 14 non-blank lines but snippet has 13

### F-004 - onclosenamespace emitted for inherited namespaces

**Claim:** closeTag emits onclosenamespace for every key in tag.ns when tag introduced a binding, not just introduced bindings, and builds unused copy x intended for diffing.

**Reason:** citation range expects 12 non-blank lines but snippet has 11

## Moderate confidence (weak refutation)

_None this run._
## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
