# F1 dogfood — HAND-CHECK (CodeProof on its own `src/`)

**Date:** 2026-10-29. · **Code:** `2e7cf6d` (chunked; HEAD at run time) · **Adjudicator:** DSH orchestrator
**Runs (reports/final/self-analysis/):**

| Run | Dir | Models | Findings | Cost | Duration |
|---|---|---|---|---|---|
| chunked | `chunked/4cf698ba270f207e` | spark 1.3 / wonder 1.0 | 6 proposed → **5 verified, 1 uncertain**, 0 refuted, 1 reproduced, 1 patch-proven | **$2.2969** | 1195 s |
| single | `single/3ccffc296ca227aa` | spark 1.3 / wonder 1.0 | **0 proposed** | **$0.1495** | 74 s |

**F1 total: $2.4464** (estimate $4.5; block cap $6). Honest outcome: the single scan of the whole `src/` found nothing, the chunked scan found 6 — the same pattern as in earlier rounds (chunked recall > single).

## Adjudication of every finding

| ID | System status | Claim (short) | Adjudication | Severity (manual) | Evidence / method |
|---|---|---|---|---|---|
| F-001 | uncertain | Cross-verification is activated only for the `wonder` label, not for `secondary` (when the models are the same) | **not a defect — intentional behaviour** | — | `cli.mjs:471`: the cross-verifier makes sense only when there is a **second** model; the `secondary` label appears exactly when the secondary scanner is the same model (there is nothing to cross-check). The verifier did not confirm it (empty output, `finish_reason=length`). No fix; the clarification belongs in the code/comment (optional). |
| F-002 | verified | `byScanner` counting ignores the `secondary` label | **real** | low | `cli.mjs:433-438`: `spark/wonder/both/controlled` are counted; a `secondary` entry goes into `proposed` but not into any counting bucket → wrong `run.json.findings.byScanner` and log. Does not change findings, only accounting. **Fix + regression test.** |
| F-003 | verified (patch-proven) | The `wordRegex` cache is `{}` → inherited properties (`toString`, `constructor`, `__proto__`) return a non-RegExp and `.test` throws | **real** | medium | `repro/static-checks.mjs:7-12`: `__idRegexCache[name]` truthiness; an inherited function passes the guard; called at `:137`/`:140`. Reproduced 3/3 + patch-proven 3/3. **Fix + regression test.** |
| F-004 | verified | `hasTautology` looks for self-comparison in the whole file, not in the assert segments → falsely rejects valid repros | **real** | medium | `repro/static-checks.mjs:112-114`: `selfCompare.test(code)` before `extractAssertSegments`. `x === x` outside an assert breaks the classification. **Fix + regression test.** |
| F-005 | verified | `firstJsonObject`: a backslash outside a string is treated as an escape and skips the next character → wrong object boundary | **real** | low | `run/json.mjs:55-59`: `escape` is set regardless of `inString`. Robustness of the dirty-JSON parser; affects retry/parse. **Fix + regression test.** |
| F-006 | verified | The LinkCheck proof suffix is emitted for every status != `unproven`, so an `error`/failed report claims "the imported symbol executed" | **real** | medium | `synthesize/index.mjs:189-192`; the `error` status really occurs in `repro/linkcheck.mjs:93,101`. A false claim about execution proof in the public REPORT — serious for honesty. **Fix + regression test.** |

**Adjudication conclusion:** **5 real defects** (F-002…F-006), **0 false findings**, **1 not a defect** (F-001) and **0 unadjudicated**. All real ones go to fix + regression test (the test is written by an assistant, the author is in the commit message, test-lock), then a re-run of dogfood on the fixed code (PREREG §4.2).

## 2. Fixes and re-run (after adjudication)

**Fixes (author DSH, commit `1b07caf`):** F-002 `countByScanner` (+ `secondary` bucket; `cli.mjs` uses it);
F-003 prototype-less cache (`Object.create(null)`); F-004 self-comparison only in assert segments;
F-005 backslash is an escape only inside a string; F-006 proof suffix only for `proven` LinkCheck.

**Regression tests (author codex):** `tests/dogfood-fixes.test.mjs` (5 tests, each failed before the fix),
test commit `0cc0849`, test-lock `2f1c568`. Suite: **268/268** on Node 26 and Node 22, integrity PASS.

**Re-run on the fixed code (revision `2f1c568`, through `final-run.sh`):**

| Run | Dir | Result | Cost | Duration |
|---|---|---|---|---|
| chunked-r2 | `chunked-r2/8adb643a9ac70162` | **0 proposed** | **$0.3793** | 363 s |
| single-r2 | `single-r2/8f1a9861e591b2d7` | **0 proposed** | **$0.1214** | 42 s |

**F1 total:** 4 attempts = **$2.9470** (estimate $4.5; block cap $6). Manifest: `reports/final/ATTEMPTS.jsonl` (attempt 1–4).

**Reading of the re-run:** none of the five fixed defects appears on the fixed code, but the re-run returned 0 candidates in both chunked and single mode — model variance is large (chunked r1: 6 proposed for $2.30; chunked r2: 0 for $0.38). It is therefore reported as an **honest outcome**, not as proof that there are no other defects in the code: the proof that the fixes are correct is the **fixed code + 5 regression tests**, not the re-run.

## What was not done

- F-001 was not fixed because it is not a defect; if explicit behaviour is still wanted, that is docs/comment work, not code.
- The dogfood re-run was done and reported above (0 findings, honestly).
