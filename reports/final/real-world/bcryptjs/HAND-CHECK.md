# HAND-CHECK — bcryptjs

**Repo:** https://github.com/dcodeIO/bcrypt.js @ `1211e9a2213e0b3ee232a204b3ce899beebce31a` · scope `.` (11 f./1666 LOC)
**Runs:** `56f8831fa1284062` ($0.9219, 3 verified — 1 patch-proven), `56f8831fa1284062-2` ($0.3876, 1 verified patch-proven)
**Method:** reading the code; patch-proven findings have the generated test + patch from the run.

| Run / ID | Claim | Verdict | Severity | Evidence |
|---|---|---|---|---|
| run1 F-003 + run2 F-001 (same defect) `index.js:474-496` | `base64_decode` does not check `c4 == -1` before OR | **REAL — patch-proven; already reported upstream** | **medium** | `c1/c2/c3` have `== -1 → break`; `c4` does not: `o |= c4` with -1 gives 0xFFFFFFFF, `String.fromCharCode` = 65535, `olen++`. Execution proof: reproduced 3/3 + patch-proven 3/3 (both runs). **Not a new finding:** the same defect and the same one-line fix are already in [PR #170](https://github.com/dcodeIO/bcrypt.js/pull/170) (open since 7 Apr 2026); a comment with independent (patch-proven) confirmation was left on 30 Oct 2026. |
| run1 F-001 `index.js:172-176` | `hash()` ignores the `genSalt` error | **REAL** | **medium-low** | Numeric salt: `genSalt(salt, function (err, salt) { _hash(password, salt, …) })` without `if (err)`. `genSaltSync` throws for rounds outside 4–31 (`index.js:948-949`), so `_hash` receives an `undefined` salt and throws a second error — masking the original. |
| run1 F-002 `index.js:112-118` | `genSalt` throws synchronously for non-number rounds and when a callback is present | **REAL** | **low** | `else if (typeof rounds !== "number") throw Error(...)` before the callback; `hash/compare` argument errors are reported through the callback — inconsistent behaviour. |

**Final:** 3 real defects confirmed; 1 with **patch-proven** (and therefore execution-proven) evidence — this **satisfies DoD 7 ">=1 execution-proven / patch-proven on new repositories"**. Of the 3, **1 was already reported upstream** (base64_decode, PR #170) — the proof is independent, the finding is not new. F-001 (genSalt error) and F-002 (synchronous throw) were **not reported** upstream (trackers checked on 30 Oct).
