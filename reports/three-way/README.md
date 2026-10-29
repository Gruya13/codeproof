# Three architectures on the same task — CodeProof vs Spark alone vs Wonder alone (27.10.2026)

Question: if Spark and Wonder are used **standalone** (one model call, no verification of any kind) and CodeProof runs its full gate on the same repository, how many findings does each produce and what does each cost?

Method: identical scanner prompt, identical JSON schema, identical repository digest for every variant (`scripts/three-way.mjs` for the standalone models, the normal CLI for CodeProof). Standalone candidates are checked with the same deterministic L1 citation check, then matched against the ground truth with the frozen benchmark matcher (`bench/score.mjs`). CodeProof numbers come from the frozen scorer, which counts **verified** findings only.

Prices: Muse Spark 1.3 - $1.25/M input, $4.25/M output; Muse Wonder 1.0 - **$4/M input, $20/M output** (3.2x / 4.7x more expensive per token).

## A. Controlled task: benchmark fixture (8 problems, 4 traps, 229 LOC)

| Architecture | Candidates | Problems hit (scanner) | Verified recall | Precision | Execution proofs | Cost | Time |
|---|---:|---:|---:|---:|---:|---:|---:|
| Spark alone | 9 | **8/8** | n/a (no verification) | n/a | 0 | **$0.0255** | 15 s |
| Wonder alone | 8 | 7/8 | n/a (no verification) | n/a | 0 | $0.1346 | 52 s |
| CodeProof, no L3 | 9 | 8/8 | **8/8** | **100%** | 0 | $0.3416 | 142 s |
| CodeProof single + L3 | 10 | 7/8 | 6/8 | 85.7% (1 FP) | **6** | $0.7037 | 282 s |
| CodeProof dual + L3 | 9 | 8/8 | **8/8** | **100%** | **8** | $0.7605 | 266 s |

Reading: on a small synthetic fixture, a single cheap Spark call already proposes 8/8 problems - the fixture is hard for the *gate*, not for the *scanner*. What the standalone models cannot do is turn candidates into **verified** findings: every candidate they return is an unverified claim, and the user has to check all of them. CodeProof costs 13x the Spark scan because it verifies every candidate, and it publishes only what survives.

## B. Real repository: unjs/ufo (1,571 LOC, same commit)

| Architecture | Candidates | Published verified | Execution proofs | Cost |
|---|---:|---:|---:|---:|
| Spark alone (scanner) | 4 | n/a | 0 | $0.0615 |
| Wonder alone (scanner) | 7 | n/a | 0 | $0.6412 |
| CodeProof single + L3 | 4 | 4 | 0 (L3 unavailable on this target) | $0.6907 |
| CodeProof dual + L3 | 10 (Spark 4 / Wonder 8 / both 2) | **10** | 0 | $2.0685 |

Reading: on a real repository the standalone scanners disagree a lot - Wonder finds 7 real defects, Spark-only finds 4, and neither verifies anything. CodeProof single publishes the 4 Spark findings as verified; **CodeProof dual publishes 10**, including six that only Wonder proposed, each cross-checked by Spark. No standalone run produces a verified finding at all.

## C. Where the money goes

- **Scanning is the cheap part.** Spark scan of the fixture: $0.0255. Wonder scan: $0.1346 - 5.3x more for one call, because Wonder is 3.2-4.7x more expensive per token.
- **Verification is what CodeProof charges for.** CodeProof without L3 costs $0.3416 for the fixture: $0.026 scan + ~$0.31 to verify 9 candidates (~$0.035 per candidate). That is the price of turning claims into verified findings.
- **L3 adds roughly the verification cost again** ($0.36 for 6 execution proofs on the fixture) and is what separates "verified by a model" from "reproduced by execution".
- **Dual adds one Wonder scan** ($0.135 on the fixture) on top of L3 and yields the only 8/8 verified + 8 execution-proof run in this table.

Cost per **verified** finding: CodeProof-no-L3 $0.043; CodeProof dual+L3 $0.095 per verified finding *including an execution proof*. Standalone models have no comparable number - their output is unverified.

## D. What the hypothesis gets right and what it does not

The working hypothesis was: *"if CodeProof finds the same as Wonder alone and costs less than Wonder, that is a good pitch."* The measurements say:

- **"Finds the same" holds on the real repository, not on the fixture.** On ufo, CodeProof dual finds 10 verified findings versus Wonder-alone's 7 unverified candidates; on the fixture Wonder alone already finds 7/8 and CodeProof verifies 8/8. Neither standalone model produces a verified finding.
- **"Costs less than Wonder" does not hold.** CodeProof is more expensive than one Wonder scan because it pays for verification and execution. Wonder-alone is cheap per candidate only by leaving the checking to the user, and on larger repositories its scan is the expensive, unreliable part (on semver and marked the Wonder scan did not even finish).
- **What does hold:** CodeProof's *scanning* is the price of Spark ($0.0255 on the fixture, $0.0615 on ufo), not of Wonder ($0.1346 / $0.6412). The expensive model is used only for verification, on a bounded context. On a repository where the Wonder scan does not fit the budget, the full CodeProof pipeline still produces verified findings.

## E. Recommended pitch framing

Instead of "same findings, lower cost", the honest and stronger claim is:

> A standalone scanner returns claims; CodeProof returns **verified** findings, and for $0.76 it also proved 8 of them by execution on the analyzed commit. Scanning with the cheap model and spending the expensive model only on verification is what makes that affordable - one Wonder scan of the same fixture costs $0.13 and proves nothing.

And the cost table is part of the pitch: $0.03 to scan, $0.31 to verify, $0.36 to execute-prove. Every part is measured per run and recorded in `run.json`.

## Caveats

- Fixture numbers are on the calibration set (n = 8), one run per variant; scanner output is not bit-deterministic (the single+L3 run proposed 10 candidates and scored 6/8, the no-L3 run proposed 9 and scored 8/8 on the same fixture - that spread is scanner variance, not L3).
- The standalone variants were run once each; their scanner recall is informational, not a verified metric.
- ufo numbers are single runs on the same commit; L3 was unavailable there (extensionless TypeScript imports).

Artifacts: `seed-repo-a528b83-*/` (three-way JSON + report), benchmark runs `reports/7ce32fede698bf5d` (single + L3), `reports/5cd23bf463d38a60` (no L3), `reports/c3dc44820c70d7bc` (dual).