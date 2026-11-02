# Experiment 2026-11 — summary

Post-freeze exploratory studies on branch `experiment/post-freeze-2026-11` (base `origin/main @ 8fd429f`).
**Not part of the frozen `v0.2.3-final` evidence**; it does not change the audited headline numbers, the
pre-registered claims, the benchmark sets or the demo video. Pre-registered before the first paid call in
[EXPERIMENT-PLAN.md](EXPERIMENT-PLAN.md); every attempt is in [ATTEMPTS.jsonl](ATTEMPTS.jsonl), settled, none deleted.

**Total: 30 paid attempts, $17.7010** (round cap $35 — not reached; no attempt was retried to make a number look
better, and the two zero-finding repositories were not re-run).

| Block | Runs | Result | Cost |
|---|---:|---|---:|
| **A** — variance / repeatability | 9 | single calibration recall 6–7/8 over 7 runs (mean 82.1%), dual 8/8 in 3/3, one verified FP in 7 single runs (87.5% precision, below threshold); chunked extended 9–10/16 with 1 trap leak in 3 runs | $11.6958 |
| **B** — model role ablation | 8 | precision 100% in all four architectures; recall tracks the producer; cheapest architecture $0.0105 per verified finding vs $0.0441 for the most expensive on this set | $1.5380 |
| **C** — real-world round | 3 | 2 verified findings in `@jridgewell/sourcemap-codec`, both hand-confirmed with a machine round-trip (encoder/decoder asymmetries); devalue and json5: 0 findings | $0.6866 |
| **D** — historical recall re-run | 10 | **2/9 reproduced exactly** (the same two tests as the original run) | $3.7805 |

Detailed reports: [A-VARIANCE.md](A-VARIANCE.md) · [B-ROLE-ABLATION.md](B-ROLE-ABLATION.md) ·
[C-REALWORLD.md](C-REALWORLD.md) · [D-HISTORICAL.md](D-HISTORICAL.md).

## What this adds to the project (candidate text, not published yet)

- **Depth:** the frozen round reported one number per configuration; this round measures the spread (single-pass
  recall 6–7/8, one false positive in 7 single runs, a trap leak in 1 of 3 chunked extended runs) and reproduces
  the weakest published number (2/9) exactly.
- **Meta tooling:** the first controlled role ablation on Meta Muse models — Spark/Wonder as producer/adversary in
  all four combinations; precision came from the gate in every variant, while recall tracked the producer. The
  Spark→Spark variant verifies findings at $0.0105 each on this set, 4x cheaper than Wonder→Wonder.
- **Impact:** two independently found, mechanically confirmed encoder/decoder asymmetries in a widely used npm
  package (`@jridgewell/sourcemap-codec`), on a repository the pipeline had never seen.

## Limitations

- n is small everywhere (5–7 runs per configuration, 2 runs per architecture, 3 repositories, 9 historical
  tests); these are observed spreads, not significance tests.
- The two real-world findings are code-level asymmetries with a machine round-trip reproduction; whether the
  affected inputs occur in production and whether the findings are already known upstream was **not** established.
  No upstream issue was filed.
- Zero-finding runs and failed attempts are reported as measured (see each block report for the failure details).
- The branch was not merged into `main`; the frozen evidence and the public README were not modified.

## Large historical study (follow-up round)

After the first four blocks, the remaining credit was spent on one larger study: **30 fix commits from 6
libraries × 3 arms** (single MAX_FINDINGS=6, single MAX_FINDINGS=12, dual-scan), pre-registered in
[large-historical/PRE-REGISTRATION.md](large-historical/PRE-REGISTRATION.md) with the sample frozen before the
first paid call. **72 paid runs, $31.6061.**

- `single-6`: **6/30 hits (20.0%)**, $8.08 — the original 2/9 (22.2%) reproduced on 3.3x the sample.
- `single-12`: 6/29 (20.7%), $9.17 — **raising the candidate cap did not help** (H3 refuted).
- `dual-6`: 13/30 (stopped; Wonder scanner truncation), 2/13 (15.4%), $14.36 — **±15.4 pp lift over single on
  the paired subset** (0/13 vs 2/13), but $7.18 per hit and unreliable as configured.
- **LOC is the dominant factor:** scopes ≤500 LOC → 50% hit rate; 500–1000 → 13.3%; >1500 → 11.1%.
- By repository: dateformat 3/5, fast-json-patch 2/5, mustache 1/5, swr/ky/picomatch 0/5.

Full report: [large-historical/RESULTS.md](large-historical/RESULTS.md).

## Upstream reports

After the experiments, 43 candidates that still exist in the current HEAD were reviewed; 15 were confirmed with an
executable reproduction, and **7 issues were filed** (plus the 6 from the final round). Full status:
[UPSTREAM.md](UPSTREAM.md). Every filed issue carries a minimal repro against the current library version; 8 verified
candidates were held back (7 for cost/benefit or "by design" risk, 1 because it is already reported upstream as
mustache #846).

## Independent review

Both verifiers worked from a blind input (plan + artifacts + claims, no reasoning from the executor).

- **codex (watchdog + execution):** `WATCHDOG OK reports/experiment-2026-11/ATTEMPTS.jsonl sha256
  75c9a6735acd3f50dd414306c010e817ebfa40f626633a2e78461a125db94b75 git f62b9745895a61fd439def49cf7e03fce308a157`
  — 60 ledger commits (30 reservations + 30 settlements), attempts 1–30 gap-free, no earlier row changed, every
  `run.json` present only in the settlement commit, main untouched at `8fd429f`. It independently reproduced the
  round-trip outputs, re-checked all 30 costs against `run.json` (0 mismatches) and the tables, and found two
  text errors (fixed: a reversed 6/8-vs-7/8 distribution in A, "16 runs-pairs" → "8 runs" in B) and one
  uncommitted file (the replay check output, now committed). Its `make test` attempt was blocked by the read-only
  sandbox (`EROFS` on `mkdtemp`), which is an environment limit, not a test failure — the full `make test` in
  this branch's own run passed 268/268.
- **agy (red team):** all checked claims confirmed, **no refuted claim**; its command execution was blocked by the
  environment's sandbox guard, so its review was static/analytical (mathematical derivation of both round-trip
  failures, review of `reports/historical/`, the B cost table and the ledger sums) rather than executed.

## Publication rule check

The plan said results are published on `main` only if clean and independently reviewed. Pending the independent
review, the proposed change to `main` is exactly: one line in the README `Documentation and evidence` table plus
a `reports/exploratory/` summary folder. Nothing else.
