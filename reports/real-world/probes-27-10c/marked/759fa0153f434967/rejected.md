# Rejected and unresolved findings

Commit: 4bdd7e0c4329ad0d6fb4b4139a25fb7aeed251ea  |  run-id: 759fa0153f434967

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

### F-001 - Indent regex cache builds wrong {0,n} limit

**Claim:** cachedIndentRegex passes cacheIndex (0..3) to the factory instead of the requested indent, so every indent regex is built with one fewer space than required and indents >4 are capped to {0,3}.

**Verifier:** uncertain - The excerpt at rules.ts:3-9 shows cacheIndex is passed to createRegex, but no factory definition or cachedIndentRegex call site is shown, so it cannot be settled whether the factory expects the raw indent or intentionally receives indent-1 (e.g. adds 1 when building {0,n}); the call sites and factory bodies in rules.ts beyond line 74 are needed.

### F-003 - Link success path leaks inRawBlock state

**Claim:** outputLink saves outerInRawBlock but only restores it when bailing on nested links; on the success path the inner inlineTokens raw-block state leaks to the outer inline run and suppresses escaping afterwards.

**Verifier:** uncertain - verifier output was not parseable JSON (empty model output), finish_reason=length

