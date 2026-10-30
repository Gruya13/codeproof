# F3 — bench (final round)

**Date:** 2026-10-29 (21:00–22:20 CET) · **Code:** tag `v0.2.3-final` — every run has `src` tree `f874d642`
(check: `git rev-parse <run.commit>:src`); HEAD moved only through artifact commits.
**Executor:** DSH orchestrator, all runs through `scripts/final-run.sh` (reserve → git anchoring → run → settle).
**F3 spend:** **$5.8642** of the planned $8,2 (block cap $13).

## 1. Calibration (`bench/seed-repo`, 15 f. / 229 LOC, frozen)

| Run | Dir | Proposed | Verified | L1 rejected | Reproduced | Patch-proven | Score: recall / precision / traps / FR | Cost | Duration |
|---|---|---|---|---|---|---|---|---|---|
| single-1 | `bench-calibration/single-1/ae354d4fdabfded1` | 9 | 8 | 1 | 5 | 5 | **7/8 (87,5%)** / 100% / 0/4 / 0 | $0.9426 | 481 s |
| single-2 | `bench-calibration/single-2/77ca0cd10b081478` | 9 | 8 | 1 | 7 | 7 | **7/8 (87,5%)** / 100% / 0/4 / 0 | $1.1073 | 574 s |
| dual | `bench-calibration/dual/ad5bfdbcd9ed17eb` | 14 uniq (spark 9 / wonder 9 / both 4) | 13 | 1 | 8 | 8 | **8/8 (100%)** / 100% / 0/4 / 0 | $1.2968 | 596 s |

**Variance is reported, not hidden:** both single runs give **7/8**, dual **8/8**. All 8 verified
findings in the dual run are execution-proven; in the single runs 5/7 and 7/7. The score thresholds (≥6/8, ≥90%,
0/4 traps, ≤1 FR) pass in all three runs. One verified finding per run is `extraTrue` (X-02, a real
error outside the expected set) — the score reports it, does not count it as an FP.

**Deviation from the DoD expectation (honest):** PREREG DoD 3 expected 8/8 for the single runs; **7/8 in both**
was measured. This is model variance on the n=8 calibration set — reported as such; prompts and
sets were not changed after the first run (PREREG §2.8).

## 2. Extended (`axios lib/`, 74 f. / 9.564 LOC, frozen; 16 problems + 5 traps)

| Run | Dir | Proposed | Verified | L1 rejected | Reproduced | Score: found/16 · precision · traps | Cost | Duration |
|---|---|---|---|---|---|---|---|---|---|
| single | `bench-extended/single/f0b6d3c2b5e351ae` | 8 | 3 | 5 | 1 | **3/16 (18,8%)** / 100% / 0/5 | $0.6068 | 202 s |
| chunked | `bench-extended/chunked/27937bbf34fed1b7` | 10 (8 chunks) | 9 | 1 | 1 | **9/16 (56,3%)** / 100% / 0/5 | $1.5038 | 692 s |

**Honest:** single is **3/16**, below the planned expected range of 4–7/16; chunked is **9/16**, within
the expected 9–10/16. No trap was reported in any status; 0 false positives. Chunked scan is again the
main recall mechanism (+6 problems, +40 pp).

## 3. Held-out ablation (`bench/held-out`, 6 problems + 4 traps, never used for tuning)

| Configuration | Published | TP | FP | Trap leaks | Recall | Precision |
|---|---:|---:|---:|---:|---:|---:|
| scanner only | 6 | 6 | 0 | 0 | 1 | 1 |
| + L1 | 6 | 6 | 0 | 0 | 1 | 1 |
| + L1 + L2 | 6 | 6 | 0 | 0 | 1 | 1 |
| + L1 + L2 + L3 | 5 | 5 | 0 | 0 | 0.833 | 1 |

Dir: `bench-heldout/held-out-ec04852/` (`ablation.json` + `ABLATION.md`); cost **$0.4069**, 228 s.
**DoD 5 met:** 5–6/6 in the L3 configuration (5/6, one L3 finding `inconclusive`), 6/6 through L2, **0 traps**,
all four levels reported.

## 4. Failed attempts (reported, actual cost $0)

| Attempt | What happened | Actual cost | Ledger |
|---|---|---|---|
| 7 | `--dual-scan` is not a CLI flag; the CLI rejected the argument **before any model call** (duration 0 s) | **$0** | `unknown-cost`, the $4 reservation stays in `spentEffective` (A4: never underestimates) |
| 11 | `MODEL_API_KEY` was not loaded for the ablation; the run failed before the call | **$0** | `unknown-cost`, the $2 reservation stays |

Both are in `reports/final/ATTEMPTS.jsonl`; not a single row was deleted. Because of them `spentEffective` shows
$14.81, while **actually spent is $8.8112** (settled `costUsd`). The conservative $6 reserve is not released
mechanically — it is reported here and in the F5 verification.

## 5. F3 DoD check

| DoD | Requirement | Result |
|---|---|---|
| 3 | 2 single runs reported; dual with per-scanner status and cross-verification | ✅ both single + dual; dual `byScanner` spark 9 / wonder 9 / both 4 |
| 3 | expected 8/8 + 0/4 traps + all execution/patch-proven | ⚠️ single **7/8** both, dual 8/8; traps 0/4; execution-proven 5/7, 7/7, 8/8 (reported, not hidden) |
| 4 | extended chunked 9–10/16, single 4–7/16, 0/5 traps, both scored | ⚠️ chunked **9/16** ✅, single **3/16** (below range), 0/5 traps ✅, both scored ✅ |
| 5 | held-out 5–6/6, 0 traps, all 4 levels | ✅ 5/6 (L3) / 6/6 (L2), 0 traps, 4 levels |

**Conclusion:** F3 was measured on frozen code, all attempts are reported, the cost is well below the estimate.
Two deviations from expectations (single recall 7/8 and extended single 3/16) are model variance on small
sets and go into the public README as measured values, not as "expected".

## 6. Artifacts

- score: `bench-calibration/{single-1,single-2,dual}/score.json`, `bench-extended/{single,chunked}/score.json`
- held-out: `bench-heldout/held-out-ec04852/{ablation.json,ABLATION.md}`
- all runs: verbatim `run.json`, `findings.json`, `REPORT.md`, `REPORT.html`, `rejected.md`, `repro/`, `patch/`
- manifest: `ATTEMPTS.jsonl` (attempt 5–12)
