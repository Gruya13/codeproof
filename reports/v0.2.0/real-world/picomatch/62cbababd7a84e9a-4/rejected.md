# Rejected and unresolved findings

Commit: 6bb40679c218cefba5d4e9662408c5fdf699a8bb  |  run-id: 62cbababd7a84e9a

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

### F-004 - escaped braces marked as braces

**Claim:** When braces were entered via an escaped "\{", closing "}" still sets isBrace=true, so escaped braces are incorrectly reported as brace globs.

**Reason:** citation range expects 9 non-blank lines but snippet has 10

## Moderate confidence (weak refutation)

### F-005 - dot lookahead consumes following char

**Claim:** The single-dot check does code=advance() inside the condition, so when the second char is not a dot the lookahead char is consumed and never examined for comma handling, missing e.g. the comma in "{a.,b}".

**Verifier (muse-wonder-1.0):** refute/weak - At scan.js:113 the lookahead is assigned to the same `code` variable, and the immediately following non-else check at scan.js:125 tests that same `code` for CHAR_COMMA, so in "{a.,b}" the comma consumed as lookahead is examined and triggers the comma branch.

## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
