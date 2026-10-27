# Real-world probe round II — 27.10.2026 (L3 enabled, different domains)

Second wave of real-repository runs, deliberately different from the first (no utility/validation duplicates) and from the earlier hand-checked repos. Domains: version parsing (semver), JSON5 parsing (json5), environment-file parsing (dotenv), URL utilities (ufo) and string validation (validator.js).

| Repo | Target | Files / LOC | Proposed | Verified | L1 rejected | Reproduced | Cost |
|---|---|---:|---:|---:|---:|---:|---:|
| [npm/node-semver](https://github.com/npm/node-semver) `7257c14` | repo root | 128 / 7,581 | 1 | 1 | 0 | **1** | $0.2789 |
| [motdotla/dotenv](https://github.com/motdotla/dotenv) `c40119a` | `lib/` | 4 / 707 | 0 | 0 | 0 | - | $0.1281 |
| [json5/json5](https://github.com/json5/json5) `307a03f` | `lib/` | 7 / 1,795 | 0 | 0 | 0 | - | $0.0649 |
| [unjs/ufo](https://github.com/unjs/ufo) `f06c800` | `src/` | 7 / 1,571 | 4 | 4 | 0 | 0 | $0.6907 |
| [validatorjs/validator.js](https://github.com/validatorjs/validator.js) `9ff3424` | `src/` | 114 / 6,158 | 6 | 5 | 1 | 0 | $0.9563 |

Total: **11 candidates, 10 published, 1 rejected at L1, 0 false positives; 1 execution-proven; $2.1189.**

## Execution-proven finding (semver)

`internal/lrucache.js:25-36` — `set(key, value)` deletes an existing key and then only re-inserts the value when the key did **not** exist (`if (!deleted && value !== undefined)`). Updating an existing key therefore drops the entry: `cache.set('key', 'second')` leaves `cache.get('key') === undefined`.

- The model wrote a test that imports the real `LRUCache`, sets the same key twice, and asserts the updated value is returned; it fails 3/3 with `AssertionError: actual: undefined, expected: 'second'`.
- The repository's own test (`test/internal/lrucache.js`) never updates an existing key, which is why this survived.
- Practical impact today is limited: `classes/range.js` only calls `set` after a `get` miss, so the branch is unreachable in that usage; the class is exported and used as a general cache. Hand severity: **medium/low** (real defect, currently latent).
- Artifacts: [semver/499e42278d0530ee/](semver/499e42278d0530ee/) — `repro/F-001/test.mjs` + `result.json` with the three runner outputs.

## Other findings (hand check where done)

| Repo | Finding | Hand verdict |
|---|---|---|
| validator | F-002 `isCreditCard`: mastercard alternation is not grouped, so `^` binds only the first branch and `$` only the second — any string starting with `51xx` or ending with a `222x…` form passes | **CONFIRMED** in `lib/isCreditCard.js:9`; real false-positive surface. Upstream status not checked. |
| validator | F-006 `isVAT`: `HN` and `PA` patterns are optional-group-only (`/^(HN)?$/`), so the empty string is reported as a valid VAT | **CONFIRMED** in `lib/isVAT.js:121,124`; medium. |
| ufo | F-001 `withoutLeadingSlash('/')` returns `/` instead of `''` because of the `|| "/"` fallback (`utils.ts:235-237`) | **CONFIRMED** — contradicts the documented example; low/medium. |
| ufo | F-003 `parseAuth` splits on every colon and keeps the first two parts, so `user:pa:ss` yields password `pa` (`parse.ts:133-139`) | **CONFIRMED** — passwords containing `:` are truncated; low/medium. |
| validator | F-003 `isISO6346`, F-004 `isLicensePlate`, F-005 `isCurrency` symbol escaping | published with citations and verifier reasons; not hand-checked in this round. |
| validator | F-001 | rejected at L1 (citation range/snippet mismatch) - the strict gate working as intended. |
| ufo | F-002 `withFragment`, F-004 `URL.searchParams` array handling | published; not hand-checked. |

## What this round exposed in the system

1. **CommonJS repositories are L3-executable; extensionless ESM TypeScript is not.** semver (CJS, `require('./compare')` resolves) and dotenv (CJS) can be executed by the runner directly, and semver produced a real execution proof. ufo and validator (ESM/TS with extensionless specifiers) were correctly reported as `repro-unavailable`.
2. **The L3 static validator was over-broad about URLs.** It rejected any `http://` string, which blocked legitimate tests for a URL library (ufo produced two `inconclusive` results for this reason). URL literals as test data are now allowed; network primitives (`fetch`, `net`, `http`, `https`, `tls`, `dns`, child processes) remain forbidden and the sandbox blocks the network at runtime.
3. **Scanner truncation retry works:** dotenv's first scan call returned `finish_reason=length`; the pipeline retried with a doubled budget and completed cleanly.
4. **Recall variance is real:** dotenv and json5 produced no findings (scanner stayed silent on mature code), while validator produced five published findings on 6,158 LOC. One run per repository; no claim about defect density.

## Caveats

- Repositories are public, cloned at HEAD; the model may have seen the code. Findings are not claimed as novel discoveries, and upstream issue status was not checked for the confirmed findings in this round.
- One run per repository, n = 5; scanner/verifier output is not bit-deterministic.
- Hand checks cover four of the ten published findings; the rest are published with their citations and verifier reasons.

Artifacts: one directory per run under `semver/`, `dotenv/`, `json5/`, `ufo/`, `validator/`.