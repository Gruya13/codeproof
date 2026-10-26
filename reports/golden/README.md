# Golden benchmark run (provenance)

This directory is a **verbatim copy** of one scored benchmark run, committed so a judge can inspect the artifacts without re-running the pipeline. Nothing here is edited by hand.

- run: `26ab3dd52bcd1e4f` (post-calibration, F4 bounded verifier context; scanner prompt v3)
- mode: `bench`, `mock: false`, `repo.dirty: false`
- commit analyzed: `95c324339300d5a7e05b74fe237f385bcf99a28f` (fixture frozen at `4ca1de1`; expected.json sha256 `de244ac78e1fd16bc4fdc733910fe744dcc2b120aa17ece6a23bc43abea71c45`)
- models: scanner `muse-spark-1.3-contributor`, verifier `muse-wonder-1.0` (prompts: scanner v3, verifier v1)
- measured cost: **$0.2190**, 101.4 s, 20873 input / 13893 output tokens, 6801 cached input tokens
- scored result on the calibration set (n = 8): **8/8 verified (100%), precision 100%, traps 0/4, false refutations 0**
- verifier context is bounded to the most relevant files (24,000 character budget) instead of the whole repository; benchmark input tokens dropped from 29,408 to 20873 after this change, with identical metrics
- attempt history (no cherry-picking): see "Benchmark results" in the repository README.

Files: `run.json` (models, tokens, cache, cost, commit, budget), `findings.json` (status per finding, L1 and verifier verdicts), `REPORT.md` (verified findings and architecture), `rejected.md` (refuted/uncertain findings; empty refuted section for this run - the controlled verifier test covers the refutation path).
