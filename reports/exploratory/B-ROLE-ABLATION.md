# Block B — model role ablation (L1+L2 only)

**Protocol:** pre-registered in [EXPERIMENT-PLAN.md](EXPERIMENT-PLAN.md) §B. Four architectures on the frozen
calibration set `bench/seed-repo`, 2 runs each, `MAX_FINDINGS=8`, L3/L4 disabled (`REPRO=0 PATCH=0`) so the
comparison is producer + adversary only. Every run through `scripts/exp-run.sh`, attempts 10–17, ledger
[ATTEMPTS.jsonl](ATTEMPTS.jsonl). Scoring with the frozen `bench/score.mjs`.

| Architecture | Run | Verified TP | Precision | Traps | FR | Cost | Duration | Scanner / verifier cost | Threshold |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| **standard** Spark→Wonder | r1 | 5/8 | 100% | 0/4 | 0 | $0.1398 | 55 s | $0.0300 / $0.1099 | **fail (recall)** |
| **standard** Spark→Wonder | r2 | 6/8 | 100% | 0/4 | 0 | $0.3018 | 108 s | $0.0192 / $0.2827 | pass |
| **inversion** Wonder→Spark | r1 | 7/8 | 100% | 0/4 | 0 | $0.2069 | 81 s | $0.1575 / $0.0494 | pass |
| **inversion** Wonder→Spark | r2 | 6/8 | 100% | 0/4 | 0 | $0.1561 | 58 s | $0.1159 / $0.0402 | pass |
| **Spark→Spark** | r1 | 5/8 | 100% | 0/4 | 0 | $0.0551 | 43 s | $0.0196 / $0.0355 | **fail (recall)** |
| **Spark→Spark** | r2 | 6/8 | 100% | 0/4 | 0 | $0.0604 | 43 s | $0.0218 / $0.0386 | pass |
| **Wonder→Wonder** | r1 | 7/8 | 100% | 0/4 | 0 | $0.2791 | 74 s | $0.1164 / $0.1628 | pass |
| **Wonder→Wonder** | r2 | 7/8 | 100% | 0/4 | 0 | $0.3387 | 96 s | $0.1615 / $0.1772 | pass |

## Reading

- **L2 kept precision at 100% in every architecture** (8 runs, 0 verified false positives, 0/4 traps,
  0 false refutations). In this controlled L1+L2-only setup the adversarial step is what protects precision,
  and it did so even when the adversary was the cheaper Spark model.
- **Recall depended mostly on which model produced candidates.** Wonder as producer found 7/8 in three of four
  runs; Spark as producer found 5–6/8 in this configuration. That is consistent with the earlier three-way
  result (Wonder-only proposed more real defects than Spark-only on ufo), but it contradicts the frozen F3
  single-run numbers only on the surface: F3 ran with `MAX_FINDINGS=12` and L3/L4 enabled, so the two are
  not like-for-like.
- **Cost per verified finding** (2-run average): Spark→Spark **$0.0105**, inversion **$0.0279**,
  standard **$0.0401**, Wonder→Wonder **$0.0441**. The cheapest architecture is ~4x cheaper per verified
  finding than the most expensive one, and both are 100% precise on this set.
- **No architecture is "wrong" on n=2 runs.** The run-to-run spread inside one architecture (standard: 5 then 6;
  inversion: 7 then 6) is the same size as the gap between architectures. The one robust signal is the price
  structure: Wonder tokens cost 3.2x/4.7x more (input/output) than Spark, and a Wonder scan is ~5–8x the cost
  of a Spark scan.

## Why this matters for the project's claim

The frozen round reported a single architecture (Spark producer + Wonder adversary) and explained it by role
separation. This ablation adds the missing comparison: with the same gate, a cheaper homogeneous Spark pipeline
verifies the same kind of claims at a fraction of the cost, but proposes fewer of the hardest ones; a flipped
pipeline (Wonder producer, Spark adversary) kept a higher recall at a lower cost than the standard one on this
set. The honest statement is that **the architecture choice is a cost/recall trade-off, not a precision
requirement** — precision came from the gate itself in all four variants.

## Caveat

n = 2 runs per architecture on an 8-problem set with L3/L4 disabled; `MAX_FINDINGS=8` caps the candidate count.
This is an observed spread, not a significance test. The frozen final-round numbers remain those published in
the main README.

## Cost

Block B: **$1.5380** across 8 attempts (planned ~$6, actual much lower).
