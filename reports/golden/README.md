# Golden benchmark run (provenance)

This directory is a **verbatim copy** of one scored benchmark run, committed so a judge can inspect the artifacts without re-running the pipeline. Nothing here is edited by hand.

- run: `a17a5b3e9aa004ff` (post-calibration; scanner prompt v3)
- mode: `bench`, `mock: false`, `repo.dirty: false`
- commit analyzed: `d0cde39` (fixture frozen at `4ca1de1`; expected.json sha256 `de244ac78e1fd16bc4fdc733910fe744dcc2b120aa17ece6a23bc43abea71c45`)
- models: scanner `muse-spark-1.3-contributor`, verifier `muse-wonder-1.0` (prompts: scanner v3, verifier v1)
- measured cost: **$0.2777**, 107.3 s, 29,408 input / 12,240 output tokens, 3,500 cached input tokens
- scored result on the calibration set (n = 8): **8/8 verified (100%), precision 100%, traps 0/4, false refutations 0**
- baseline before calibration (scanner prompt v2): run `9a5a56d6`, 7/8 (NSP: B-05 missed), precision 100%, $0.2308
- attempt history (no cherry-picking): see "Benchmark results" in the repository README.

Files: `run.json` (models, tokens, cache, cost, commit, budget), `findings.json` (status per finding, L1 and verifier verdicts), `REPORT.md` (verified findings and architecture), `rejected.md` (refuted/uncertain findings; empty refuted section for this run - the controlled verifier test covers the refutation path).
