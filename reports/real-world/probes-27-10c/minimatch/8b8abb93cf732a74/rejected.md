# Rejected and unresolved findings

Commit: ded1bbd01beca62a5978bc1650ed0a1ccf9039d5  |  run-id: 8b8abb93cf732a74

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

### F-002 - Adopted AST parts keep stale parentIndex

**Claim:** After splicing adopted children into parent, code updates p.#parent but never updates p.#parentIndex, leaving stale indices that break isStart/isEnd checks for moved parts.

**Verifier:** uncertain - The excerpt at ast.ts:579-582 shows #adopt splicing gc.#parts and updating only p.#parent, but the provided excerpts contain no #parentIndex declaration or assignment, no isStart/isEnd definitions, and no #adopt call sites or post-adoption re-indexing, so whether stale indices persist or affect those checks cannot be settled from the given context.

