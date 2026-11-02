# Post-freeze exploratory studies — pre-registration

**Status:** supplementary research on a separate branch (`experiment/post-freeze-2026-11`), written from
scratch after the final round. It is **not** part of the frozen `v0.2.3-final` evidence and does not change the
audited headline numbers, the pre-registered claims, the benchmark sets or the demo video.

- **Branch base:** `origin/main` @ `8fd429f`; `src/`, `bench/` and `tests/` trees are identical to `v0.2.3-final`.
- **Registered:** 2026-11-01, **before the first paid call**. Every attempt goes through `scripts/exp-run.sh`
  (reserve -> git anchor -> run -> settle -> commit) and is recorded in `ATTEMPTS.jsonl`; no attempt is deleted.
  Runs are sequential (the ledger does not allow a second hanging reservation).
- **Credit:** $70.31 remaining on the account at registration (author's figure). Round cap **$35**, target ~$28.
- **Never touched:** `main`, tag `v0.2.3-final`, `src/`, `bench/`, `tests/`, `reports/final/`, the public README
  headline numbers and the video.

## Questions and hypotheses

### A. Variance / repeatability (Depth)
**Question:** the final round measured the calibration set twice (7/8 in both single runs, 8/8 dual). How stable is that?
**Protocol:** `bench/seed-repo` (`--mode bench`, `MAX_FINDINGS=12`): 5 new single runs; 2 new dual runs (`DUAL_SCAN=1`);
extended `axios lib/` chunked (`CHUNKED_SCAN=1`): 2 new runs.
**Pre-registered expectation:** single recall stays 7–8/8, precision 100%, 0/4 traps; dual 8/8. A run outside 6/8 or any
published trap is reported as measured, not hidden.
**Report:** per-run table + mean/range; no statistical-inference claim beyond "N runs, observed spread".

### B. Model role ablation (Meta tooling)
**Question:** why Spark as producer + Wonder as adversary? What if the roles are swapped, or if both roles use one model?
**Protocol:** 4 architectures on `bench/seed-repo`, 2 runs each, L3 disabled (`REPRO=0`): Spark→Wonder (standard),
Wonder→Spark, Spark→Spark, Wonder→Wonder. Same prompt, schema and `MAX_FINDINGS=8`; deterministic L1; scored with `bench/score.mjs`.
**Pre-registered expectation:** the standard architecture has the best verified precision per dollar; a homogeneous run
either costs more or adds false confirmations. Any outcome is reported as measured.
**Report:** candidates / verified / precision / cost / cost per verified finding.

### C. Real-world round (Impact)
**Question:** does the pipeline still find hand-confirmable defects in repositories it has never seen?
**Protocol:** 3 repositories (300–3000 LOC, JS or TS), 1 run each (a second run only if the first publishes nothing),
`--mode smoke`, `MAX_FINDINGS=12`; every published finding hand-adjudicated against the code at the pinned commit;
upstream status checked before claiming novelty.
**Rule:** publish only hand-confirmed entries; false positives and 0-finding runs are reported; no new upstream issue is
filed without an explicit author decision.
**Report:** `real-world/<repo>/` in the F4 shape + a hand-check table.

### D. Historical recall re-run (optional, Depth)
**Question:** the 2/9 historical recall is the weakest published number. Does it reproduce under the same protocol?
**Protocol:** the same 9 fix commits as `reports/historical/` (parent analyzed, smoke, `MAX_FINDINGS=6`), one re-run per
target; hits checked with the same ±3-line automated overlap + manual adjudication. No prompt or fixture changes.
**Report:** reproduced N/9 vs 2/9; any deviation explained.

## Budget and stop conditions
- Cap **$35**; start with the $2.5 pilot (A, single run 1); stop early if the pilot fails (no `run.json`, repeated API error).
- Stop when the next reservation does not fit the cap, or when a day's experiments would delay the 3.11 submission dry run
  or the 4.11 submission.
- Do not spend the remaining credit just because it exists.

## Publication rule
Only if the results are clean and independently reviewed (agy blind + codex watchdog): the main branch gets
(a) one line in the README evidence table and (b) `reports/exploratory/` with the summary; the frozen claims stay untouched.
Otherwise the branch stays internal and nothing is published.
