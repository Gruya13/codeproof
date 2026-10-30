# Final evaluation — reports/final (2026-10-29/30)

Final measurement round on **frozen code**: tag [`v0.2.3-final`](FREEZE.json) (revision `490e302`,
`src` tree `f874d642`). Every run went through `scripts/final-run.sh` (reservation → git anchoring → run →
settle); all attempts are in [`ATTEMPTS.jsonl`](ATTEMPTS.jsonl) and none was deleted.
**Total round cost: $15.7163 of $40** (target $35 — not met; hard cap not exceeded).
Plan and reviews: [PREREG](PREREG.md) + [A1](PREREG-AMENDMENT-1.md)–[A4](PREREG-AMENDMENT-4.md) + [REVIEW](PREREG-REVIEW.md).

> **Note on re-publication:** anything from this round that was **already published earlier** (the v0.2.2 sample
> in the public README, upstream issues/PRs) is marked here as **re-confirmed** and is not presented as a
> new finding. The table in §4 separates what is new from what is repeated.

## 1. F0 — deterministic baseline

| Check | Result |
|---|---|
| Tests | **268/268** on Node 26.8.2 and Node 22.23.3 |
| Integrity | PASS 22 checks (baseline `2040aa9`) |
| Replay | 9/9 identical, 0 mismatch |
| Score golden | PASS |
| Clean clone (tmpfs + `env -i`) | PASS |
| Clean clone Docker `node:22-alpine` | PASS |
| Budget wrapper | `final-budget.mjs` (reserve/check/settle/audit) + `final-run.sh`; A4 cost validation; hard cap $40 cannot be undercut; git-anchored reservation before every run |

Details: [F0-baseline.md](F0-baseline.md).

## 2. F1 — dogfood (CodeProof on its own `src/`)

| Run | Findings | Cost | Duration |
|---|---|---|---|
| chunked r1 | 6 proposed → 5 verified, 1 reproduced, 1 patch-proven | $2.2969 | 1195 s |
| single r1 | 0 proposed | $0.1495 | 74 s |
| chunked r2 (after fixes) | 0 proposed | $0.3793 | 363 s |
| single r2 (after fixes) | 0 proposed | $0.1214 | 42 s |

**5 real defects fixed** (F-002…F-006) + **5 regression tests** (author codex, test-lock);
1 report was not a defect (F-001), 0 false positives. Details: [self-analysis/HAND-CHECK.md](self-analysis/HAND-CHECK.md).
**F1 total: $2.9470.**

## 3. F3 — bench (on frozen code)

### Calibration (`bench/seed-repo`, 229 LOC, n=8)

| Run | Verified | Score: recall / precision / traps / FR | Cost |
|---|---|---|---|
| single-1 | 8 | **7/8 (87,5%)** / 100% / 0/4 / 0 | $0.9426 |
| single-2 | 8 | **7/8 (87,5%)** / 100% / 0/4 / 0 | $1.1073 |
| dual | 13 | **8/8 (100%)** / 100% / 0/4 / 0 | $1.2968 |

Both single runs and the dual run are reported; the variance is not hidden. Details: [F3-bench.md](F3-bench.md).

### Extended (`axios lib/`, 9.564 LOC, 16 problems + 5 traps)

| Run | Defects verified | Precision / traps | Cost |
|---|---|---|---|
| single | **3/16 (18,8%)** | 100% / 0/5 | $0.6068 |
| chunked | **9/16 (56,3%)** | 100% / 0/5 | $1.5038 |

### Held-out (`bench/held-out`, 6+4)

| Configuration | Published | TP | FP | Trap | Recall |
|---|---:|---:|---:|---:|---:|
| scanner only / +L1 / +L2 | 6 | 6 | 0 | 0 | 1 |
| +L1+L2+L3 | 5 | 5 | 0 | 0 | 0.833 |

**F3 total: $5.8642.**

## 4. F4 — real world (5 new repos + regression)

### 4a. NEW in this round (not published in earlier rounds; upstream status in §4d)

| Repo | Pin | Findings (hand-confirmed) | Evidence | Cost |
|---|---|---|---|---|
| mustache | `972fd2b2` | 2 defects (F-001 is correct and already reported upstream — PR #854) | citation+adversarial | $0.8823 |
| sax | `961ceeef` | 2 defects (1 latent) + 1 rejected by hand | citation+adversarial | $1.1172 |
| fast-json-patch | `9d313ac0` | 4 defects | citation+adversarial | $0.7511 |
| bcryptjs | `1211e9a2` | 3 defects, **1 unique defect patch-proven in both runs** | execution + patch | $1.3095 |
| dateformat | `e6800aa9` | 1 defect (+ one 0-finding run) | citation+adversarial | $0.2662 |

**New findings in F4: 12 unique defects** (mustache 2, sax 2, fast-json-patch 4, bcryptjs 3, dateformat 1).
**Upstream status:** 2 had **already been reported** before our analysis (mustache PR #854, bcryptjs PR #170 — not new),
**3 were reported on 30.10.** (fast-json-patch #337, dateformat #196, sax #303), 3 comments were left on existing
reports, and 5 remain unreported — details in §4d. Hand-check: [mustache](real-world/mustache/HAND-CHECK.md) ·
[sax](real-world/sax/HAND-CHECK.md) · [fast-json-patch](real-world/fast-json-patch/HAND-CHECK.md) ·
[bcryptjs](real-world/bcryptjs/HAND-CHECK.md) · [dateformat](real-world/dateformat/HAND-CHECK.md).

### 4b. RE-CONFIRMED — already published earlier, now independently re-confirmed

| Finding | Pin | Where it was already published | This run | Evidence |
|---|---|---|---|---|
| picomatch: the trailing token is not set when the last slash is at index 0 (`prevIndex` truthiness) | `6bb40679` (= 4.0.7, same pin as v0.2.2) | public README §v0.2.2 sample ("leading slash skips the last token update") — already published | `14ba4cc9` | **patch-proven** |
| jsesc: negative numbers in hex/bin/oct yield an invalid literal (`0x-FF`) | `e3349b54` (= v3.1.0, same pin as v0.2.2) | public README §v0.2.2 sample + **upstream [jsesc #79](https://github.com/mathiasbynens/jsesc/issues/79)** (PR #80 open, partial fix) | `ea5b1ae7`, `1e1b03c5` (dual) | **patch-proven** |
| jsesc: unknown `numbers` option → `undefined` | same | not published before; in this round `uncertain`, hand-confirmed in the hand-check | `ea5b1ae7` | static |
| jsesc: dead `else if (isBigInt)` branch | same | not published before | `ea5b1ae7` | static (informational) |

**Re-confirmed role:** the regression pair proves that **L3/L4 work the same as before hardening** (PREREG DoD 7);
the same defects were found again and proven by execution. These findings are **not published as new**.

### 4c. Regression — cost

| Target | Cost |
|---|---|
| picomatch (1 run) | $0.5465 |
| jsesc (1 run) | $0.6289 |
| jsesc dual (1 run, after 1 aborted attempt) | $1.4033 |

**F4 total: $6.9050.**

## 4d. Upstream check and reports (30.10.2026)

**6 reports filed in total:** three from the v0.2.2 sample (picomatch [#242](https://github.com/micromatch/picomatch/issues/242), [#243](https://github.com/micromatch/picomatch/issues/243), jsesc [#79](https://github.com/mathiasbynens/jsesc/issues/79), 28.10.) and three from this round (30.10.).

| Upstream status | Findings |
|---|---|
| **Already reported before the analysis** (duplicates; disclosed honestly) | mustache F-001 → PR [#854](https://github.com/janl/mustache.js/pull/854) (+[#856](https://github.com/janl/mustache.js/issues/856)); bcryptjs F-003 → PR [#170](https://github.com/dcodeIO/bcrypt.js/pull/170) |
| **New issues opened on 30.10.** | fast-json-patch F-001 → [#337](https://github.com/Starcounter-Jack/JSON-Patch/issues/337); dateformat F-001 → [#196](https://github.com/felixge/node-dateformat/issues/196); sax F-001 → [#303](https://github.com/isaacs/sax-js/issues/303) |
| **Comments on existing reports** | mustache #854 (independent confirmation), bcrypt PR #170 (patch-proven confirmation), fast-json-patch PR [#331](https://github.com/Starcounter-Jack/JSON-Patch/pull/331) (`isInteger("")` manifestation, same root) |
| **Unreported** | mustache F-002, fast-json-patch F-002/F-004, bcryptjs F-001/F-002, sax F-003 (latent) |

No finding was reported as a "new discovery" — the public commits predate the analysis; each report cites the exact pin.

## 5. DoD status (PREREG §6)

| # | Requirement | Result |
|---|---|---|
| 1 | every headline number has a fresh artifact | ✅ all tables above have a run dir |
| 2 | deterministic set fresh | ✅ 268/268 × 2 Node, integrity/replay/score/demo/clean-clone/Docker |
| 3 | calibration: 2 single reported; expected 8/8 | ⚠️ single **7/8** both; dual 8/8 — reported |
| 4 | extended chunked 9–10/16, single 4–7/16, 0/5 traps | ⚠️ chunked **9/16** ✅; single **3/16** (below range) |
| 5 | held-out 5–6/6, 0 traps, 4 levels | ✅ 5/6 (L3), 6/6 (L2), 0 |
| 6 | dogfood: 0 unadjudicated, all real ones fixed + test | ✅ |
| 7 | real world: ≥1 execution/patch-proven on new repos; hand-check; 0 false | ✅ execution/patch: bcryptjs; hand-check 24/24; ⚠️ 1 rejected by hand (sax F-002) |
| 8 | agy-verify + codex WATCHDOG | see [F5-baseline](F5-baseline.md) and the verification records |
| 9 | frozen artifacts untouched | ✅ integrity PASS |
| 10 | README/STATUS without stale numbers | see the public README section "Final evaluation" |

## 6. Limitations

- The calibration set is n=8 and was used for calibration — not a statistical claim.
- Real-world findings are anecdotes (small n, public commits → contamination possible). Upstream status: 2 of 12 were already reported (duplicates), 3 reported on 30.10. — **no report has a maintainer reply yet**, so there is no external confirmation.
- Model output is not bit-deterministic; the number of attempts is always stated.
- `execution-proven`/`patch-proven` exist only on Node 26.8.2 (LinkCheck requires `--allow-inspector`).
- `spentEffective` is **$25.7163** because $10 consists of `unknown-cost` reservations from three aborted/rejected attempts (attempt 7, 11, 25; actual cost $0 — the CLI rejected before any model call); the settled cost of the round is **$15.7163**.
- Record-keeping logic: `reports/golden/` and the other frozen artifacts are historical (26–28.10.) and untouched; the final round uses `reports/final/`.
