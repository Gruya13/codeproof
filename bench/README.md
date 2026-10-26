# Benchmark — design (F2)

> Synthetic benchmark repository authored during the Meta Global AI Developer Hackathon. **Not a product.**
> **Frozen after the first benchmark run on 27.10.2026.** After that, changes only by commit with a reason.
> **Calibration set:** the same fixture is used to calibrate prompts and to report final metrics, so every published number is labelled "on the calibration set" and always carries **n = 8**.

## Purpose

Prove that the verification gate works deterministically - not that CodeProof analyzes a real repository. The fixture is small and controlled on purpose:

- **8 injected correctness defects** (`correctness` / `direct`), each with a citation that L1 can check;
- **4 traps** (negative controls) - patterns that look wrong but are correct; one trap (T-04) can only be refuted with cross-file context;
- **2 pre-registered real defects** (extraTrue) - genuine bugs that are not among the 8; they count as neither TP nor FP, so a correct extra finding can never lower precision;
- **expected.json** with file and line numbers, so a judge can verify the numbers were not hand-made.

Size: **15 TypeScript files, 229 LOC**.

## How it is used

1. `make bench` runs the pipeline on `bench/seed-repo` (needs `MODEL_API_KEY`; use `muse-spark-1.3-contributor` for cheap calibration runs).
2. `make score` scores the newest report against `bench/expected.json` using `bench/score.mjs`.
3. Results are copied into the README and used in the demo video; the table always includes `n` and the calibration label.

## Metrics and thresholds

See `scoring` in [expected.json](expected.json). In short:

| Metric | Threshold |
|---|---|
| End-to-end recall (verified / 8) | >= 6/8 |
| Precision (verified-only) | >= 90% (with n = 8, practically zero false positives) |
| Traps published as verified | 0/4 (moderate shown separately) |
| False refutations (real problem refuted) | <= 1 |
| Scanner recall (proposed / 8) | measured, no threshold |

Metrics are computed from the **status** field in `findings.json`, never from where a finding is displayed.

## Adjudication

Rules are in [adjudication.md](adjudication.md) and are written before the first run. The adjudicator is the fixture author; the rules are public so a judge can re-check them.

## What this is not

- Not a proof of real-world quality; it is a demonstration of the gate. A real open-source repository is used only as a qualitative anecdote in the video, never as a metric.
- Not a claim of completeness: the fixture checks direct defects only; omission, security and architecture findings are out of scope.
- `expected.json` and this design must never enter the model context. The scanner sees only code.
