# Rejected and unresolved findings

Commit: b4eb83bbb48107720d95162ccecf829ba16be91e  |  run-id: 6cd8009a29058221

This file records candidates not confirmed by both gates, including citation failures and budget skips. A counter-citation is checked for presence, not semantic relevance.

## Rejected at L0 (candidate format)

_None this run._
## Rejected at L1 (citation check)

_None this run._
## Moderate confidence (weak refutation)

### F-006 - Blockquote text accumulator uses raw length

**Claim:** blockquote list-continuation trims text accumulator by raw length and appends raw, inconsistent with blockquote branch which uses text lengths, corrupting text/raw accounting

**Verifier (muse-wonder-1.0):** refute/weak - Tokens.List has no text property at Tokens.ts:138-145 while Tokens.Blockquote does at Tokens.ts:32-37, so the list branch at Tokenizer.ts:215 cannot use oldToken.text/newToken.text; the list token parsed from currentText at Tokenizer.ts:184 contributes its raw to the stripped text accumulator, making raw-based trimming/appending correct rather than corrupting.

## Skipped (budget)

_None this run._

## Refuted

_None this run._
## Uncertain

_None this run._
