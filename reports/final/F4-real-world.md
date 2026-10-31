# F4 — real world (final round)

**Date:** 2026-10-29/30 (22:40–01:15 CET) · **Code:** tag `v0.2.3-final` (`src` tree `f874d642`)
**Executor:** DSH orchestrator, all runs through `scripts/final-run.sh` (reserve → git anchoring → run → settle).
**F4 spend:** **$6.9050** of the planned $10.

## 1. Candidate selection (before spending — `REALWORLD-CANDIDATES.lock.json`, commit `638f7bd`)

5 selected (out of 8 dry-run candidates), all CJS/ESM, no runtime dependencies, 300–3000 LOC, pinned commit:

| Repo | Pin | Scope | Files/LOC | Result (2 runs) | Cost |
|---|---|---|---|---|---|
| mustache | `972fd2b2` | `. ` | 80 / 2402 | 3 verified entries (**2 defects**) | $0.8823 |
| sax | `961ceeef` | `lib` | 1 / 1866 | 4 entries (**2 real**, 1 rejected, 1 latent) | $1.1172 |
| fast-json-patch | `9d313ac0` | `commonjs` | 3 / 803 | 4 entries (**4 defects**) | $0.7511 |
| bcryptjs | `1211e9a2` | `. ` | 11 / 1666 | 4 entries (**3 defects, 1 unique patch-proven in both runs**) | $1.3095 |
| dateformat | `e6800aa9` | `. ` | 43 / 2085 | 1 entry (**1 defect**; run1 0 findings) | $0.2662 |

**Rejected dry-run candidates (reported, $0):** argparse 4892 LOC and accounting 6483 LOC (>3000 per PREREG §4.5); uuid — TS source without committed JS output. Replacement: **dateformat** (candidate #4 per the replacement plan).

## 2. Regression pair (same pins as v0.2.2; A1 condition 4 / A2 §2)

| Target | Pin | Run | Result | Cost |
|---|---|---|---|---|
| picomatch | `6bb40679…` | `14ba4cc9` | 1 verified **patch-proven** | $0.5465 |
| jsesc | `e3349b54…` (sha256 `03c367cb…`) | `ea5b1ae7` | 2 verified (**1 patch-proven**) + 1 verified (dead code) + 1 uncertain | $0.6289 |
| jsesc dual | same | `1e1b03c5` | 2 verified **patch-proven** (1 root cause), spark 1 / wonder 1 | $1.4033 |

**Regression confirmed:** L3/L4 work the same as before hardening; the same defect (negative radix literals) was independently found and proven by execution.

## 3. Dual-scan — first attempt failed (reported)

Attempt 25 (`probe-repo.mjs` with `DUAL_SCAN=1` on jsesc) was **aborted after 900 s** — the probe harness's internal spawn cap, not an API error. Actual cost $0 (aborted before `run.json`), the $4 reservation stays as `unknown-cost` (A4). Cause: Wonder scanner truncation + retry (32k tokens) → the dual run takes ~29 min. The retry (attempt 26) was measured **directly by the CLI** through `final-run.sh` (without the probe wrapper) and succeeded in 1722 s.

## 4. Manual adjudication (HAND-CHECK per repo)

**22 published entries hand-checked** (21 `verified` + 1 `uncertain`: 20 confirmed, 1 false positive, 2 latent/dead code; each with status, severity and verification method) (`<repo>/HAND-CHECK.md`, overview in [MANUAL-VALIDATION-OVERVIEW.md](../../02-manual-validation/MANUAL-VALIDATION-OVERVIEW.md)):

| Outcome | Count | Detail |
|---|---:|---|
| Confirmed real defect | **20** (of 21 `verified` entries) | each confirmed by reading the code; includes 2 latent/dead code (sax F-003 unreachable branch, jsesc F-003 dead code) and mustache F-001 (the original assessment was wrong — **the TypeError is real**, second lookup) |
| **Rejected — not a defect** | **1** (of 21 `verified`) | sax F-002 (a valueless attribute cannot be an xmlns declaration; by design) |
| Uncertain, hand-confirmed (not `verified`) | **1** | jsesc F-002 (unknown `numbers` option → `undefined`) |

**Honestly reported:** 1 false positive finding (sax F-002) among the 21 `verified` entries (22 published in total); the 0-finding run is reported (dateformat run1). No finding was hidden or embellished.

## 4b. Upstream check and reports (30.10.2026)

All 12 confirmed defects were checked in the public trackers and, where it made sense, reported.
**3 of 12 were known upstream before our analysis** — they are not new findings and are presented as such.

| # | Repo / defect | Upstream status |
|---|---|---|
| 1 | mustache — cache `hasOwnProperty` shadowing | **already reported**: PR [#854](https://github.com/janl/mustache.js/pull/854) (open; linked [#856](https://github.com/janl/mustache.js/issues/856)) — comment with independent confirmation |
| 2 | mustache — cache key collision | **already reported in 2020**: [#762](https://github.com/janl/mustache.js/issues/762) (closed in 2021 as stale) — not new |
| 3 | sax — `SGML_DECL_QUOTED` without `parser.q` | **reported 30.10.**: [#303](https://github.com/isaacs/sax-js/issues/303) |
| 4 | sax — `new Error(parser, …)` (latent) | not reported (unreachable branch, no impact) |
| 5 | fast-json-patch — null deref `obj.toJSON` | **reported 30.10.**: [#337](https://github.com/Starcounter-Jack/JSON-Patch/issues/337) |
| 6 | fast-json-patch — `isInteger("")` | the root is covered by PR [#331](https://github.com/Starcounter-Jack/JSON-Patch/pull/331) (leading zero) — comment with the manifestation |
| 7 | fast-json-patch — observe overwrites the mirror baseline | unreported (low) |
| 8 | fast-json-patch — `~~key` truncation | unreported (low) |
| 9 | bcryptjs — `base64_decode` c4 | **already reported**: PR [#170](https://github.com/dcodeIO/bcrypt.js/pull/170) (open) — comment with independent (patch-proven) confirmation |
| 10 | bcryptjs — hash ignores the `genSalt` error | unreported |
| 11 | bcryptjs — `genSalt` throws synchronously | unreported |
| 12 | dateformat — `yyyy` negative years | **reported 30.10.**: [#196](https://github.com/felixge/node-dateformat/issues/196) |

**Summary:** **3 previously known upstream** (duplicates — disclosed honestly, not presented as new: mustache #854 open, mustache #762 closed in 2021, bcrypt #170 open) · **3 new issues opened on 30.10.** · **1 comment** on an existing PR (fjp #331) plus comments on the two known reports (#854, #170) · **1 latent finding deliberately not reported** · **4 findings remain unreported** (low impact / design decision needed). None was reported as a "new discovery" — the public commits predate the analysis.

## 4c. Hand-check correction (mustache F-001)

The original adjudication wrongly claimed that no cache write occurs and that there is no TypeError.
**Corrected:** the first lookup for `hasOwnProperty` falls into the `else` branch (the inherited method is not an *own* property of the cache),
so the value is written into the cache; the **second** lookup of the same name throws `TypeError: cache.hasOwnProperty is not a function`.
The original claim from the run is **correct**, and upstream PR #854 independently confirms it.

## 5. DoD 7 check

| Requirement | Result |
|---|---|
| ≥1 execution-proven and ≥1 patch-proven on new repos | ✅ **bcryptjs**: 1 unique defect, patch-proven in both runs (execution + patch, reproduced 3/3) |
| all published hand-adjudicated | ✅ 22/22, HAND-CHECK per repo |
| 0 false after the hand-check | ⚠️ **1 rejected** (sax F-002) — reported, not hidden |
| 0-finding repos reported as such | ✅ dateformat run1 (0 findings) |
| the regression pair proves L3/L4 as before hardening | ✅ picomatch + jsesc patch-proven |
| ≥1 refuted / rejected finding for the video (S5) | ⚠️ there is no **refuted** finding in F4 (all verified/uncertain); for S5 a recorded marked controlled test or a manually rejected finding (sax F-002) is used — decision in F5 |
| upstream status of every finding reported | ✅ §4b: 3 already known (duplicates: #854, #762 closed in 2021, #170), 3 reported on 30.10., 1 comment + comments on the two known reports, 4 unreported + 1 latent not reported — none presented as a new discovery |

## 6. Cost and manifest

- F4: **$6.9050** (12 successful runs + 1 aborted, actual $0; 1 retry).
- Round total: **$15.7163** of $40 (settled). `spentEffective` $25.7163 due to $10 of unknown-cost reservations (attempt 7 $4, 11 $2, 25 $4) — conservative, reported.
- Manifest `ATTEMPTS.jsonl`: attempt 13–26; `audit` PASS.

## 7. Artifacts

`real-world/<repo>/{probe.json,scope.json,<run>/}` + `HAND-CHECK.md` per repo; all runs verbatim (`run.json`, `findings.json`, `REPORT.md`, `REPORT.html`, `rejected.md`, `repro/`, `patch/`). The `_repo` clones are git-ignored.
