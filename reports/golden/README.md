# Golden benchmark run (provenance)

The run artifacts in this directory (`run.json`, `findings.json`, `REPORT.md`, `rejected.md`) are **verbatim copies** of one scored benchmark run, committed so a judge can inspect the pipeline output without re-running it. This `README.md` is provenance documentation written after the run; it is not part of the run output and is the only hand-authored file in this directory.

- run: `231fc717dc282c88` (strict L1 gate: **every** citation must pass and the snippet must match the declared line range)
- mode: `bench`, `mock: false`, `repo.dirty: false`
- commit analyzed: `06ab5f8dbcf2c8210492b49efe4f251147cb13d5` (fixture frozen at `4ca1de1`; expected.json sha256 `de244ac78e1fd16bc4fdc733910fe744dcc2b120aa17ece6a23bc43abea71c45`)
- models: scanner `muse-spark-1.3`, verifier `muse-wonder-1.0` (scanner prompt v3; verifier prompt v1 with the T-01 example replaced)
- measured cost: **$0.2947**, 98.8 s, 18,974 input / 15,892 output tokens, 2,000 cached input tokens
- scored on the calibration set (n = 8): **7/8 verified (87.5%), precision 100%, traps 0/4, false refutations 0**; one candidate rejected at L1
- replay over these artifacts (`make replay`): **8/8 identical, 0 mismatches**

## Why this run replaces `26ab3dd`

On 27.10.2026 the gate was made stricter and the verifier prompt was neutralized:

1. **L1 now requires every citation to pass** (previously one passing citation was enough) and the snippet must have exactly as many lines as the declared line range.
2. The verifier prompt example that was literally a line from the benchmark trap T-01 was replaced with a fictional example.
3. The weak-refutation retry no longer forces a `refute/strong` with a counter-citation.
4. The verifier no longer receives the scanner's `severity`/`confidence`; L0/L1 rejects and `moderate` findings are now recorded in `rejected.md`.

The earlier 8/8 was produced by a looser gate. Under the stricter gate one candidate (F-008) is rejected at L1 because its snippet length did not match its declared range, so recall is **7/8**. This is reported honestly, not hidden. The two runs are not directly comparable because both the gate and the verifier prompt changed.

Files: `run.json` (models, tokens, cache, cost, commit, budget), `findings.json` (status per finding, L1 and verifier verdicts), `REPORT.md` (verified findings, committed citation lines, evidence levels, architecture), `rejected.md` (L1/L0 rejects, moderate, uncertain and budget skips).