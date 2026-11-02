# Exploratory studies after the freeze (2 Nov 2026)

These are the post-freeze exploratory studies: done **after** the `v0.2.3-final` freeze, on a separate branch, with
the remaining Meta API credit. They are not part of the frozen final-round evidence and do not change any headline
number in the main README; they are published here because the project's own rules ask for the spread of the
measurements, not just the point estimates.

- **Pre-registration:** [EXPERIMENT-PLAN.md](EXPERIMENT-PLAN.md) (written before the first paid call).
- **Ledgers:** [ATTEMPTS.jsonl](ATTEMPTS.jsonl) (first round) and
  [large-historical/{single-6,single-12,dual-6}/ATTEMPTS.jsonl](large-historical/); every paid attempt is recorded,
  a reservation is committed before the call and settled after it, no attempt is deleted.
- **Cost:** $50.10 of the remaining $70.31 credit across 106 attempts.

## Results

| Document | What it covers |
|---|---|
| [SUMMARY.md](SUMMARY.md) | Overall summary: variance, role ablation, real-world round, historical re-run, upstream reports |
| [A-VARIANCE.md](A-VARIANCE.md) | Repeating the frozen measurements: single 6–7/8 over N=7, dual 8/8 over 3/3, one false positive in 7, a trap leak in one of 3 chunked runs |
| [B-ROLE-ABLATION.md](B-ROLE-ABLATION.md) | Spark/Wonder as producer/adversary in all four combinations: precision came from the gate, recall tracked the producer |
| [C-REALWORLD.md](C-REALWORLD.md) | Three unseen repositories; two new hand-confirmed defects in `@jridgewell/sourcemap-codec` with machine round-trip repros |
| [D-HISTORICAL.md](D-HISTORICAL.md) | Re-running the original 9 historical tests: 2/9 reproduced exactly |
| [large-historical/RESULTS.md](large-historical/RESULTS.md) | 30 new fix commits × 3 arms: 20.0% hit rate, candidate cap did not help, scope size dominated |
| [UPSTREAM.md](UPSTREAM.md) | All upstream reports: 13 issues in total (6 final round + 7 from this round), 8 verified candidates held back, follow-up status |

## Reproduction

The two sourcemap-codec findings can be reproduced with the scripts in
[checks/smc-roundtrip/](checks/smc-roundtrip/):

```bash
node --experimental-strip-types checks/smc-roundtrip/rt.mjs
node --experimental-strip-types checks/smc-roundtrip/rt-generated.mjs
```

(`scopes.ts`, `strings.ts` and `vlq.ts` are unmodified copies of the package source at the analyzed commit, with
`.ts` extensions added to the imports; MIT license, see the analyzed repository.)

The filed issue texts are kept verbatim in [issues/](issues/).

## What this does not change

The numbers in the main README's "Measured results (frozen at `v0.2.3-final`)" table stand as measured in the final
round. The exploratory round adds measurements and honest deltas on top; where it disagrees with a headline number
(the single calibration run's 7/8, the "100% precision" phrasing, the "0 traps" phrasing), the disagreement is
stated in [SUMMARY.md](SUMMARY.md) and reflected in the README's "What CodeProof does not claim" section.
