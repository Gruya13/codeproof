# Rejected and unresolved findings

Commit: b2dbad2812b6b0a157875401b631109e6ab8d29c  |  run-id: afe3e8dd50723038

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

_None this run._
## Moderate confidence (weak refutation)

### F-004 - Trailing-comma fix corrupts string contents

**Claim:** Trailing-comma replacement runs without respecting string literals, so valid JSON containing comma-brace inside a string is corrupted before parsing.

**Verifier (muse-wonder-1.0):** refute/weak - Valid JSON is not corrupted because run/json.mjs:5 returns JSON.parse(candidate) on success, so the replacement at run/json.mjs:10 only runs after that parse has already failed.

## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
