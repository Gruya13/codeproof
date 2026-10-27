# Golden benchmark run (provenance)

The run artifacts in this directory (`run.json`, `findings.json`, `REPORT.md`, `rejected.md`) are **verbatim copies** of one scored benchmark run, committed so a judge can inspect the pipeline output without re-running it. `repro/<findingId>/` contains every generated reproducer test and its runner result exactly as the run wrote them. This `README.md` is provenance documentation written after the run; it is not part of the run output and is the only hand-authored file in this directory.

- run: `de7a1ccf9801a77f` (strict L1 gate + **L3 execution proof**)
- mode: `bench`, `mock: false`, `repo.dirty: false`
- commit analyzed: `8b690c77a5814bde3b0396e34a1470062d440a13` (fixture frozen at `4ca1de1`; expected.json sha256 `de244ac78e1fd16bc4fdc733910fe744dcc2b120aa17ece6a23bc43abea71c45`)
- models: scanner `muse-spark-1.3`, verifier `muse-wonder-1.0`, reproducer `muse-wonder-1.0` (scanner prompt v3; verifier prompt v1 with neutral examples)
- measured cost: **$0.6204**, 168.8 s, 25,322 input / 32,504 output tokens, 3,580 cached input tokens
- scored on the calibration set (n = 8): **8/8 verified (100%), precision 100%, traps 0/4, false refutations 0**; 9/9 published findings are **execution-proven**
- repro: 3 runs per test, 2 s timeout, `node --permission` sandbox with a network guard; every test fails 3/3 with an assertion error and the assertion message matches the claim
- replay over these artifacts (`make replay`): **9/9 identical, 0 mismatches**

## What L3 adds

For each finding confirmed by L1+L2, the verifier model writes a standalone `node:assert` test. A deterministic runner executes it on a `git archive` snapshot of the analyzed commit inside a permission-model Node process: no network, no writes outside the snapshot, 2 s timeout, three runs. `execution-proven` is assigned only when all three runs fail with an assertion error. The test code, all three runner results and the stderr are kept under `repro/` so the claim can be re-checked by hand.

## Why this run replaces `231fc717`

The previous golden run had no L3: a finding was `verified` when the citation and the adversarial verifier passed. This run adds the execution proof. The strict L1 gate from the previous change (every citation must pass; the snippet must have exactly as many lines as the declared range) is unchanged. The scanner is not bit-deterministic: this run proposed nine candidates that all passed L1, while the previous run had one candidate rejected at L1 (7/8 recall). Both runs are described in the repository README; neither is hidden.

Files: `run.json` (models, tokens, cache, cost, commit, budget, repro counts), `findings.json` (status, L1 check, verifier verdict, reproducer result per finding), `REPORT.md` (evidence level per finding, committed citation lines, generated test and runner output for execution-proven findings, architecture), `rejected.md` (L0/L1 rejects, moderate, uncertain and budget skips), `repro/<findingId>/test.mjs` + `result.json`.

## Provenance note (later hardening)

This run was produced before the L3 hardening of 27.10.2026 (commit `fd8449d`): the reproducer validator now also requires a relative import of repository code and forbids `console.*` / `process.stdout|stderr.write`. One committed reproducer (`F-006`) contains a `console.log` and would be rejected by the current validator; the artifacts here remain **verbatim** because they are the evidence of that run, not regenerated evidence. The current rules are documented in the repository README and enforced by `tests/repro.test.mjs`.