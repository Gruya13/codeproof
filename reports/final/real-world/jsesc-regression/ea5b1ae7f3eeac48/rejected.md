# Rejected and unresolved findings

Commit: e3349b542eaaf55239cb60519991b80097cee24b  |  run-id: ea5b1ae7f3eeac48

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

### F-002 - Unknown numbers option returns undefined instead of string

**Claim:** If options.numbers is not decimal/hexadecimal/binary/octal, inner result stays undefined and the function returns undefined (or 'undefinedn' for BigInt) instead of a string.

**Verifier:** uncertain - The excerpt at jsesc.js:213-231 shows a conditional chain with no else and a subsequent return of the inner result, but the definitions of useDecNumbers/useHexNumbers/useBinNumbers/useOctNumbers and any defaulting or validation of options.numbers are not in the provided excerpts, so it cannot be settled whether an unknown numbers value makes all four flags false.

