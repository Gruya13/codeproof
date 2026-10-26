# Golden benchmark run (provenance)

This directory is a **verbatim copy** of one scored benchmark run, committed so a judge can inspect the artifacts without re-running the pipeline. Nothing here is edited by hand.

- run: `9a5a56d676fbdb2e`
- mode: `bench`, `mock: false`, `repo.dirty: false`
- commit analyzed: `b0e6568` (fixture frozen at `4ca1de1`; expected.json sha256 `de244ac78e1fd16bc4fdc733910fe744dcc2b120aa17ece6a23bc43abea71c45`)
- models: scanner `muse-spark-1.3-contributor`, verifier `muse-wonder-1.0` (prompts: scanner v2, verifier v1)
- measured cost: **$0.2308**, 93.2 s, 26,255 input / 11,918 output tokens, 4,000 cached input tokens
- scored result on the calibration set (n = 8): **7/8 verified (87.5%), precision 100%, traps 0/4, false refutations 0**
- explanation of the miss and the attempt history: see "Benchmark results" in the repository README.

Files: `run.json` (models, tokens, cache, cost, commit, budget), `findings.json` (status per finding, L1 and verifier verdicts), `REPORT.md` (verified findings and architecture), `rejected.md` (refuted/uncertain findings; empty refuted section for this run - see the controlled verifier test in the README for the refutation path).
