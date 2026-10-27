# Rejected and unresolved findings

Commit: 4bdd7e0c4329ad0d6fb4b4139a25fb7aeed251ea  |  run-id: 2d8a93e9b019f92a

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

### F-001 - Cached indent regex uses cache index as indent

**Claim:** cachedIndentRegex creates the regex from cacheIndex instead of indent, so indent 1 gets {0,0}, indent 2 gets {0,1}, indent 3 gets {0,2} and any larger indent gets {0,3} instead of {0,indent}.

**Verifier:** uncertain - The excerpt at rules.ts:9 shows createRegex(cacheIndex) with cacheIndex derived at rules.ts:6, but no provided excerpt shows any call site of cachedIndentRegex or how its callback converts the argument into a {0,N} quantifier, so the claimed {0,0}/{0,1}/{0,2}/{0,3} mapping cannot be settled without seeing the callback definitions in rules.ts beyond line 74.

