# Real-world results — final round (F4)

> Excerpt from the final evidence package (30 Oct 2026). Raw artifacts for all 13 runs are in [reports/final/real-world/](../reports/final/real-world/); the round plan is in [reports/final/](../reports/final/).

**Data source:** `../reports/final/real-world/<repo>/<runId>/run.json` — every number in the tables was copied from that file (a script read all 13 `run.json` files; nothing was typed by hand).

**Round:** tag `v0.2.3-final` (revision `490e302`, `src` tree `f874d642`), 29–30 Oct 2026.
All runs are real API calls (`mock: false`), through `scripts/final-run.sh` (reserve → git anchor → run → settle).

## 1. Summary

| Metric | Value |
|---|---:|
| Runs (10 on 5 new repositories + 3 regression runs) | 13 |
| Candidates proposed (scanner) | 29 |
| Rejected at L0 (format) | 0 |
| Rejected at L1 (citation) | 7 |
| **Passed both gates (`verified`, L1+L2)** | **21** |
| Rejected by the verifier (`refuted`, L2) | 0 |
| Undecided (`uncertain`) | 1 |
| Execution-proven (`reproduced`, L3) | 6 |
| Patch-proven (`patched`, L4) | 6 |
| Cost of these 13 runs | **$6.9050** |

> `verified` means L1 citation + L2 adversarial confirmation. `reproduced` / `patched` are additional levels of proof (L3/L4)
> and do not change the `verified` status. Manual adjudication is a separate step — see [02-manual-validation/](../02-manual-validation/).

## 2. Per repository and run

| Group | Repo | Pin (commit) | Scope | Files / LOC | Run | Files in prompt | Proposed | L0 | L1 | **Verified** | Refuted | Uncertain | Repro | Patch | Cost | Duration |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| new repository | mustache | 972fd2b27a036888acfcb60d6119317744fac7ee | . (whole repo) | 80 f. / 2402 LOC | 4d11c6d684b65418 | 80 / 80 | 2 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | $0.4756 | 199 s |
| new repository | mustache | 972fd2b27a036888acfcb60d6119317744fac7ee | . (whole repo) | 80 f. / 2402 LOC | 4d11c6d684b65418-2 | 80 / 80 | 1 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | $0.4067 | 187 s |
| new repository | sax | 961ceeefcc5186005466f2085aeb36f31b161e37 | lib | 1 f. / 1866 LOC | 86ed5667b2ec15cc | 1 / 1 | 4 | 0 | 3 | **1** | 0 | 0 | 0 | 0 | $0.3164 | 146 s |
| new repository | sax | 961ceeefcc5186005466f2085aeb36f31b161e37 | lib | 1 f. / 1866 LOC | 86ed5667b2ec15cc-2 | 1 / 1 | 3 | 0 | 0 | **3** | 0 | 0 | 0 | 0 | $0.8008 | 361 s |
| new repository | fast-json-patch | 9d313ac01916e525e9204074f06e5295edec491b | commonjs | 3 f. / 803 LOC | 4e12c16371305216 | 3 / 3 | 4 | 0 | 3 | **1** | 0 | 0 | 0 | 0 | $0.2514 | 137 s |
| new repository | fast-json-patch | 9d313ac01916e525e9204074f06e5295edec491b | commonjs | 3 f. / 803 LOC | 4e12c16371305216-2 | 3 / 3 | 4 | 0 | 1 | **3** | 0 | 0 | 0 | 0 | $0.4997 | 259 s |
| new repository | bcryptjs | 1211e9a2213e0b3ee232a204b3ce899beebce31a | . (whole repo) | 11 f. / 1666 LOC | 56f8831fa1284062 | 11 / 11 | 3 | 0 | 0 | **3** | 0 | 0 | 1 | 1 | $0.9219 | 326 s |
| new repository | bcryptjs | 1211e9a2213e0b3ee232a204b3ce899beebce31a | . (whole repo) | 11 f. / 1666 LOC | 56f8831fa1284062-2 | 11 / 11 | 1 | 0 | 0 | **1** | 0 | 0 | 1 | 1 | $0.3876 | 139 s |
| new repository | dateformat | e6800aa902fcbd523d5ea06a9a79050878cfa48e | . (whole repo) | 43 f. / 2085 LOC | fead8f9fa0544305 | 43 / 43 | 0 | 0 | 0 | **0** | 0 | 0 | 0 | 0 | $0.0717 | 41 s |
| new repository | dateformat | e6800aa902fcbd523d5ea06a9a79050878cfa48e | . (whole repo) | 43 f. / 2085 LOC | fead8f9fa0544305-2 | 43 / 43 | 1 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | $0.1945 | 99 s |
| regression | picomatch-regression | 6bb40679c218cefba5d4e9662408c5fdf699a8bb | lib | 5 f. / 2445 LOC | 14ba4cc9f28e0092 | 5 / 5 | 1 | 0 | 0 | **1** | 0 | 0 | 1 | 1 | $0.5465 | 286 s |
| regression | jsesc-regression | e3349b542eaaf55239cb60519991b80097cee24b | analysis-target | 1 f. / 337 LOC | ea5b1ae7f3eeac48 | 1 / 1 | 3 | 0 | 0 | **2** | 0 | 1 | 1 | 1 | $0.6289 | 308 s |
| regression | jsesc-dual-r2 | e3349b542eaaf55239cb60519991b80097cee24b | analysis-target | 1 f. / 337 LOC | 1e1b03c5d8ba9776 | 1 / 1 | 2 | 0 | 0 | **2** | 0 | 0 | 2 | 2 | $1.4033 | 1722 s |

## 3. Configuration per run (evidence that the prompt is identical in all 13)

| Run | Mode | Node | CodeProof | Scanner prompt | Verifier prompt |
|---|---|---|---|---|---|
| 4d11c6d684b65418 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 4d11c6d684b65418-2 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 86ed5667b2ec15cc | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 86ed5667b2ec15cc-2 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 4e12c16371305216 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 4e12c16371305216-2 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 56f8831fa1284062 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 56f8831fa1284062-2 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| fead8f9fa0544305 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| fead8f9fa0544305-2 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 14ba4cc9f28e0092 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| ea5b1ae7f3eeac48 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 1e1b03c5d8ba9776 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |

All 13 runs use the **same** scanner prompt version and SHA256 (`e0b10604b50f…` = v3) and the same verifier version
(`e2e6c4a4ddbe…` = v1). This is because the code was frozen before the round (`FREEZE.json`) and no prompt was
changed during the measurement.

## 4. What is in which file

| File | Contents |
|---|---|
| `run.json` | full configuration, models, **prompt SHA256**, commit, LOC, finding counts, usage, phases, `repro`/`patch` statuses, artifact attestation |
| `findings.json` | every published finding: id, claim, citation (path/startLine/endLine/snippet), status, evidence level, verifier verdict, counter-evidence |
| `REPORT.md` / `REPORT.html` | human report of the same run (HTML is a static copy, no JS and no network) |
| `rejected.md` | candidates that did **not** pass both gates, by phase (L0/L1/moderate/refuted/uncertain) — see the per-run files in `../reports/final/real-world/` |
| `candidates.json` | all candidates before the gates (raw scanner output) |
| `repro/`, `patch/` | generated test (L3) and proposed patch (L4) where they existed |
| `probe.json`, `scope.json` | probe-harness input: scope, file/LOC count, run command |

## 5. Upstream status (30 Oct 2026)

Details and links: `../02-manual-validation/UPSTREAM-STATUS.md`. In short: **no report has been accepted or merged**;
3 of the 12 defects were already known upstream before the analysis (mustache PR #854; mustache issue #762, closed in 2021; bcryptjs PR #170),
3 are new issues opened on 30 Oct (fast-json-patch #337, dateformat #196, sax #303), 1 is a comment on an existing PR
(#331) plus comments on the two known reports, 1 latent finding was deliberately not reported, and 4 remain unreported.

## 6. For honesty (limitations, as the documents themselves state them)

- **n = 13 runs on 8 pins**: an anecdote, not a statistical measure; public commits → contamination is possible.
- **3 of the 12** defects in the new repositories are **duplicates** — already reported before our analysis (two still open, one closed in 2021) and labelled as such, not as new discoveries.
- **0 maintainer responses** on 30 Oct 2026: the status is "filed", not "accepted".
- **dateformat run1** returned 0 findings — and that is published, not hidden.
- **sax F-002** passed both gates and manual review rejected it as `by design` — 1 false positive in the set, reported in `02-manual-validation/`.
