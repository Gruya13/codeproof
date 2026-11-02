# Block A — variance / repeatability

**Protocol:** pre-registered in [EXPERIMENT-PLAN.md](EXPERIMENT-PLAN.md) §A. Every run went through
`scripts/exp-run.sh` (reserve -> git anchor -> run -> settle -> commit); attempts 1–9, ledger
[ATTEMPTS.jsonl](ATTEMPTS.jsonl). The configuration is identical to the frozen final round:
calibration `bench/seed-repo --mode bench --max-findings 12`; extended `axios lib/` (`--mode smoke`,
`CHUNKED_SCAN=1`). The final-round runs are included for comparison and were not re-run.

## Calibration set (8 problems, 4 traps)

| Run | Attempt | Verified TP | Precision | Traps | FR | Cost | Duration | Threshold |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| final single-1 (F3) | — | 7/8 | 100% | 0/4 | 0 | $0.9426 | 481 s | pass |
| final single-2 (F3) | — | 7/8 | 100% | 0/4 | 0 | $1.1073 | 574 s | pass |
| new single r1 | 1 | 6/8 | 100% | 0/4 | 0 | $0.7673 | 264 s | pass |
| new single r2 | 2 | 7/8 | 100% | 0/4 | 0 | $0.9189 | 285 s | pass |
| new single r3 | 3 | 6/8 | 100% | 0/4 | 0 | $0.7179 | 226 s | pass |
| new single r4 | 4 | 6/8 | 100% | 0/4 | 0 | $0.8135 | 256 s | pass |
| new single r5 | 5 | 7/8 + 1 FP | 87.5% | 0/4 | 0 | $1.1062 | 370 s | **fail (precision)** |
| final dual (F3) | — | 8/8 | 100% | 0/4 | 0 | $1.2968 | 596 s | pass |
| new dual r1 | 6 | 8/8 | 100% | 0/4 | 0 | $1.4522 | 445 s | pass |
| new dual r2 | 7 | 8/8 | 100% | 0/4 | 0 | $1.5026 | 501 s | pass |

**Single runs, N=7 (2 final + 5 new):** recall 6–7/8, mean **6.57/8 (82.1%)** — 6/8 in three runs, 7/8 in
four. One run published one verified false positive (precision 87.5%, below the 90% threshold); 0/4 traps
and 0 false refutations in all seven.
**Dual runs, N=3:** 8/8, 100% precision, 0/4 traps in all three.

## Extended set (axios `lib/`, 16 injected defects, 5 traps, chunked scan)

| Run | Attempt | Verified defects | Published | FP | Precision | Traps | Cost | Duration |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| final chunked (F3) | — | 9/16 | 9 | 0 | 100% | 0/5 | $1.5038 | 692 s |
| new chunked r1 | 8 | 9/16 | 14 | 5 | 64.3% | **1/5** | $2.3377 | 635 s |
| new chunked r2 | 9 | 10/16 | 11 | 1 | 90.9% | 0/5 | $2.0795 | 704 s |

**Chunked extended, N=3:** 9, 9, 10 of 16 (mean 9.33/16, 58.3%); precision 100%, 64.3%, 90.9%; one of three
runs leaked a trap (1/5) and published five verified false positives.

## Reading

- **Recall is the volatile part.** Single-pass calibration recall moves between 6/8 and 7/8 (the frozen round
  happened to get 7/8 twice); the dual configuration was 8/8 in all three runs. The published "8/8 dual" is
  stable; "7/8 single" should be read as 6–7/8.
- **The gate is not perfectly precise on repeated runs.** One single run (r5) published a verified false
  positive (the `ledger summary` claim at `src/ledger.ts:6`), and one chunked extended run published five,
  one of which leaked a trap. This is the first observed trap leak in this project's recorded runs
  (0/4 and 0/5 in the frozen round).
- **Cost and duration** are stable within a configuration (~$0.7–1.1 single, ~$1.3–1.5 dual, ~$1.5–2.3
  chunked extended) but 30–50% higher than the frozen round's runs in the extended case.
- **Caveat:** N=5–7 per configuration is still small — this is an observed spread, not a confidence interval.
  The frozen final-round numbers remain those published in the main README; nothing here changes them.

## Cost

Block A: **$11.6958** across 9 attempts (all settled, none deleted). The planned estimate was ~$9–11.
