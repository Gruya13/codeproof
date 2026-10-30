# PREREG — final testing round (bench + dogfood + real world)

**Status: LOCKED v1.0** · locked 2026-10-29. · author: DSH orchestrator (with user approval)
**Lock record:** `reports/final/PREREG.lock.json` (sha256 of this file, git HEAD, time, baseline).
**Execution: NOT STARTED.** The round starts only on explicit approval; the first step after approval is the commit of this file + the lock (proof that the prereg precedes the first run), then Phase 0.
**Language:** English (this document and the public evidence are kept in English).

## 0. Locked user decisions (29.10.2026.)

| # | Decision |
|---|---|
| 1 | New runs go to `reports/final/`; `reports/golden/` stays untouched (frozen evidence, integrity baseline `2040aa9`). |
| 2 | Dogfood: both modes — chunked + single. |
| 3 | Real world: 5 new repos + 2 regression (picomatch, jsesc). |
| 4 | Dual-scan included: calibration bench (1 run) + jsesc (1 run). |
| 5 | Target **$35**, hard cap **$40**. |
| 6 | Recording: raw material during the round (only after the freeze), final scenario/narration/edit after the round. |

## 1. Starting state (verified on 29.10.2026. before the lock)

| Item | Value | Evidence |
|---|---|---|
| Revision | `dde6e58` (v0.2.2 + package F), `main = origin/main`, clean tree | `git status -sb` |
| Deterministic | **241/241** (Node 26.8.2), 36 test files | `make test` |
| Integrity | **PASS, 22 checks**, baseline `2040aa9`, test-lock OK | `node scripts/integrity.mjs` |
| Replay / score | 9/9; golden PASS | `make replay`, `make score RUN=reports/golden` |
| Public documentation | README claims **234/234** → stale, actual 241/241 | `codeproof/README.md:52`, root `README.md` |
| Spent so far | **≈$42.46** API (dedup 98 `run.json`) | sum of `usage.costUsd` across `reports/**` |
| Evidence age | golden 27.10. (pre v0.2.0), extended 28.10. (pre L4), dogfood `@25c2a26`, real-world sample 28.10. (pre hardening A–F); `REPORT.html` from no real run | `reports/v0.2.0/`, `reports/golden/` |

**Round goal:** all headline numbers fresh, on the final code, with the same, honest protocol.

## 2. Principles (binding)

1. **Prereg.** This plan is locked before the first run; changes only through an amendment (§10.4).
2. **Dogfood first.** If dogfood finds a real defect, the fix + regression test come before the freeze and before the bench/real-world measurements.
3. **Freeze, then measure.** All bench/real-world measurements run on the tagged revision `v0.2.3-final`; after the freeze only documentation changes (exception: a P0 bug in the tool, with an amendment and a re-run of the affected items).
4. **All attempts are reported** — including truncation/retry/abort/failed runs; no run is dropped from the record.
5. **Numbers only from `run.json`.** No number is copied by hand.
6. **Hand-check of every published real-world finding** (confirmed/refuted/latent + severity + verification method).
7. **Independent verification** before the final numbers are written: agy-verify (blind input) + codex-verify (WATCHDOG: test-lock hash + git revision).
8. **No tuning after the first run** (neither prompts nor sets); calibration is already frozen.

## 3. Phase order

| Phase | Content | Dependency | API |
|---|---|---|---|
| 0 | Deterministic control layer (Node 22/26, integrity, replay, score, demo, clean-clone + docker) | — | $0 |
| 1 | Dogfood (chunked + single) → adjudication → fixes + regression tests | Phase 0 | ~$4,5 |
| 2 | Freeze: commit + tag `v0.2.3-final`; revision record | Phase 1 | $0 |
| 3 | Bench: calibration single ×2 + dual ×1; extended chunked + single; held-out ablation | Phase 2 | ~$8,2 |
| 4 | Real world: 5 new ×2 + regression (picomatch, jsesc) + dual jsesc; hand-check | Phase 2 | ~$10,0 |
| 5 | Publication: `reports/final/README.md`, README/STATUS sync, verification, push, recordings | Phase 3,4 | $0 |

## 4. Plan per phase

### 4.1 Phase 0 — deterministic control layer ($0)

Commands (in order, everything must PASS), from `codeproof/`:

```
make test                                   # Node 26: 241/241
mise exec node@22.23.3 -- make test        # Node 22: 241/241
node scripts/integrity.mjs                  # PASS 22
make replay                                 # 9/9
make score RUN=reports/golden               # PASS
make demo                                   # MOCK MODE prolazi
make clean-clone                            # tmpfs + env -i
make clean-clone-docker                     # node:22-alpine
```

Output: `reports/final/F0-baseline.md` (exact numbers, times, revision).

### 4.2 Phase 1 — dogfood (~$4,5)

Goal: CodeProof on its own `src/` (22 files / 4.879 LOC @ pre-fix `dde6e58`).

```
BUDGET_USD=4 CHUNKED_SCAN=1 node src/cli.mjs analyze src --mode smoke --out reports/final/self-analysis/chunked --allow-output-in-target
BUDGET_USD=3 node src/cli.mjs analyze src --mode smoke --out reports/final/self-analysis/single --allow-output-in-target
```

Process: manual adjudication of every proposed finding (real/latent/intentional/false) → for each real one: fix + regression test (test-lock, author in the commit message) → re-run `make test`/`integrity` → re-run dogfood if the fix changed the analyzed code (from the reserve).
Expectation (not a commitment): historical chunked 11 proposed → 9 verified / 3 exec / 2 patch-proven; single 3/3.
Output: `reports/final/self-analysis/` + `HAND-CHECK.md` + fixes.

### 4.3 Phase 2 — freeze

- commit all dogfood fixes and artifacts; tag `v0.2.3-final`;
- `reports/final/FREEZE.json`: revision, date, `make test` count, hash of `src/`;
- from this moment bench and real-world are measured; the code is not changed until the end of the round.

### 4.4 Phase 3 — bench (~$8,2)

**Calibration** (`bench/seed-repo`, 15 files/229 LOC, 8+4, frozen):

```
BUDGET_USD=2.5 MAX_FINDINGS=12 node src/cli.mjs analyze bench/seed-repo --mode bench --out reports/final/bench-calibration/single-1
node bench/score.mjs --run reports/final/bench-calibration/single-1
BUDGET_USD=2.5 MAX_FINDINGS=12 node src/cli.mjs analyze bench/seed-repo --mode bench --out reports/final/bench-calibration/single-2
BUDGET_USD=4 DUAL_SCAN=1 MAX_FINDINGS=12 node src/cli.mjs analyze bench/seed-repo --mode bench --out reports/final/bench-calibration/dual
```

Both single runs and the dual run are reported (the variance is not hidden).

**Extended** (`bench/extended`, axios `lib/` 74 files/9.564 LOC, 16+5, frozen):

```
BUDGET_USD=4 node src/cli.mjs analyze reports/probes/real/axios-extended/_repo/lib --mode smoke --out reports/final/bench-extended/single
BUDGET_USD=5 CHUNKED_SCAN=1 node src/cli.mjs analyze reports/probes/real/axios-extended/_repo/lib --mode smoke --out reports/final/bench-extended/chunked
node scripts/score-injected.mjs --expected bench/extended/expected.json --run <dir>
```

(`_repo` exists locally; if missing, reconstruct it via `scripts/make-injected.mjs` — network, no API cost.)

**Held-out** (`bench/held-out`, 6+4, frozen; not used for tuning):

```
BUDGET_USD=2 node scripts/ablation.mjs --repo bench/held-out --out reports/final/bench-heldout
```

### 4.5 Phase 4 — real world (~$10)

Criteria for the new repos: CJS or ESM with explicit extensions (L3/L4 executable), **no runtime dependencies**, 300–3.000 LOC, public pinned commit, not used in earlier rounds.
Candidates (5 are chosen after the dry run; swapping a candidate changes neither scope nor cost):
`mustache`, `fast-json-patch`, `bcryptjs`, `sax`, `argparse` (fallback: `dateformat`, `accounting`, `uuid`).

Before spending: `node scripts/probe-repo.mjs --repo <url> --scope <dir> --dry-run` for all 5 (measures files/LOC/prompt cap; $0).

Runs (2 per repo):

```
BUDGET_USD=4 node scripts/probe-repo.mjs --repo <url> --commit <sha> --scope <dir> --runs 2 --mode smoke --tag <name> --out reports/final/real-world/<name>
```

Regression pair (1 run each, same pins as v0.2.2):

```
BUDGET_USD=4 node scripts/probe-repo.mjs --workdir ../real-world/picomatch --scope lib --runs 1 --mode smoke --tag picomatch --out reports/final/real-world/picomatch-regression
BUDGET_USD=4 node scripts/probe-repo.mjs --workdir ../real-world/jsesc --scope analysis-target --runs 1 --mode smoke --tag jsesc --out reports/final/real-world/jsesc-regression
```

Dual on a small real codebase:

```
BUDGET_USD=4 DUAL_SCAN=1 node scripts/probe-repo.mjs --workdir ../real-world/jsesc --scope analysis-target --runs 1 --mode smoke --tag jsesc-dual --out reports/final/real-world/jsesc-dual
```

Hand-check: every published finding → `HAND-CHECK.md` in the run directory (status, severity, verification method, upstream link if one exists).

### 4.6 Phase 5 — publication ($0)

- `reports/final/README.md` — final tables (bench, extended, held-out, dogfood, real-world, dual) with run-id, cost, number of attempts;
- `codeproof/README.md` + root `README.md`: fresh numbers and test count (234 → 241+), section "Final evaluation (2026-10-30)", golden described as historical (27.10.) and untouched;
- `STATUS.md` entry for the day of the round;
- `make test`/`integrity`/`replay` final; `git status` clean; push;
- recordings: raw material from Phases 1–4 is archived in `reports/final/captures/` (text logs) — video files stay outside the repo.

## 5. Budget and control

| Block | Runs | Estimate | Block cap |
|---|---:|---:|---:|
| F0 deterministic | 0 API | $0 | $0 |
| F1 dogfood chunked + single | 2 | $4,5 | $6 |
| F3 bench calibration single ×2 | 2 | $2,2 | $4 |
| F3 bench calibration dual ×1 | 1 | $1,8 | $3 |
| F3 extended chunked + single | 2 | $3,8 | $5 |
| F3 held-out | 1 | $0,4 | $1 |
| F4 real world 5 × 2 | 10 | $7,5 | $10 |
| F4 regression picomatch + jsesc | 2 | $1,5 | $2 |
| F4 dual jsesc | 1 | $1,0 | $2 |
| **Core** | **21** | **$22,7** | **$33** |
| Options (three-way, controlled, historical recall) | ~5 | $2,0 | $3 |
| Reserve (retry/truncation/re-run after a fix) | — | $5,0 | $7 |
| **Total** | | **~$29,7** | — |
| **Target / hard cap** | | **$35 / $40** | |

Control: per-run `BUDGET_USD` as specified; the cost is summed from `run.json` after each phase.
**Stop-loss:** before Phase 4 check the sum — if it is >$25, real world shrinks to 4 new repos (not 5); if the total reaches **$35**, the round stops (except the reserve for a re-run after a dogfood/freeze fix, and only with a note in the amendment). The hard cap **$40** is never exceeded under any condition.

## 6. Definition of success (DoD)

1. Every headline number in the README has a fresh artifact in `reports/final/` (revision, date, run-id, cost, number of attempts).
2. Deterministic: ≥241/241 on Node 22/26, integrity PASS, replay 9/9, score PASS, demo, clean-clone (tmpfs + docker) — fresh after the freeze.
3. Calibration: 2 single runs reported; expected 8/8 + 0/4 traps + all execution/patch-proven; dual run reported with per-scanner status and cross-verification. If the numbers drop — report it honestly and state the variance.
4. Extended: chunked 9–10/16, single 4–7/16, 0/5 traps; both scored.
5. Held-out: 5–6/6, 0 traps, all 4 ablation levels.
6. Dogfood: 0 unadjudicated findings; all real ones fixed with a regression test; if there are no findings — that is a result too.
7. Real world: ≥1 execution-proven and ≥1 patch-proven on the new repos; all published ones hand-adjudicated; 0 false positives after hand-check; 0-finding repos reported as such; the regression pair proves that L3/L4 work the same as before hardening.
8. Independent verification: agy-verify confirmed all numbers blindly; codex-verify **WATCHDOG OK** (hash + git revision).
9. `reports/golden/` and the other frozen artifacts untouched (integrity PASS).
10. README/STATUS without stale numbers; root and public README in sync.

## 7. Risks and kill criteria

| Risk | Probability | Mitigation |
|---|---|---|
| dogfood finds a defect → delay | medium | the phase comes first; reserve $7 and 1 day (until 1.11.) |
| truncation/retry raises the cost (seen: marked $2.18, picomatch $1.53) | medium | estimates +30%; per-run cap; stop-loss |
| real-world 0 findings | medium | report honestly; the regression pair carries the L3/L4 evidence; prompts are not touched |
| dual degrades (Wonder scan does not fit) | low on small targets | dual only on the calibration (229 LOC) and jsesc (337 LOC) |
| L3/L4 fails after hardening | low | regression pair + replay; if it fails → P0 fix + amendment + re-run from the reserve |
| time overrun before the video (2–3.11.) | low | the round closes on 1.11.; the video uses the finished artifacts |
| false saving — skipping runs | — | every skipped run is explicit in `reports/final/README.md` |

## 8. Recording — hybrid policy

- **During the round (after the freeze):** raw material — terminal recordings of runs (dogfood chunked, extended chunked, bench), `REPORT.html` in the browser, replay without a key, a real-world finding. OBS/ffmpeg are available; text logs of the runs are archived in `reports/final/captures/`.
- **After the round:** final scenario (3 min), shot selection, narration, editing, `ffprobe` ≤180 s. The scenario depends on the final numbers and the strongest finding — hence afterwards.
- Rules: only code at `v0.2.3-final` is recorded; `.env`/keys masked; every shot carries the real run-id from `reports/final/`; a mock shot never as a real run.

## 9. Limitations — what the round does not prove

- L3/L4 evidence (`execution-proven`/`patch-proven`) exists only on Node 26.8.2 (LinkCheck requires `--allow-inspector`); on Node 22 the same run yields `link-unproven` and the finding stays `verified`.
- L3/L4 work only for code that is directly executable (CJS or ESM with explicit extensions, no external dependencies); everything else is `repro-unavailable`.
- Isolation is process-level (`node --permission`), not OS-level.
- The calibration set is n=8 and was used for calibration — it is not a statistical claim.
- Real-world results are anecdotes (small n, public commits → contamination possible).
- Model output is not bit-deterministic → the number of attempts is always stated.
- Replay proves that the record is unchanged and that the mechanical gates still pass; it does not prove the semantic L2 judgement.

## 10. Evidence protocol

### 10.1 Artifacts per run
Every run stores verbatim: `run.json`, `findings.json`, `REPORT.md`, `REPORT.html`, `rejected.md`, `candidates.json`, `repro/`, `patch/`. Commit in `reports/final/<block>/<run>`.

### 10.2 Hand-check
`HAND-CHECK.md` per real-world repo: for every published finding — status (confirmed/refuted/latent/wrong severity), verification method (reading the code / running a small repro / upstream issue), and the final rating.

### 10.3 Independent verification
- **agy-verify** (blind input: spec + artifacts + claims, without my reasoning) checks every final number and that there is no cherry-picking;
- **codex-verify** runs the watchdog: `git show <rev>:<rel>` hashed into the lock (`test-lock`), integrity PASS;
- no model verifies its own work.

### 10.4 Plan changes (amendment)
After the lock this file is **not changed**. Every change goes into `reports/final/PREREG-AMENDMENT-<n>.md` (date, reason, what changes, impact on the budget) and a new `PREREG.lock.json` hash. The original stays untouched — the same principle as test-lock.

## 11. Lock record

- the `sha256` of this file is recorded in `reports/final/PREREG.lock.json` together with the time, the git HEAD (`dde6e58`), the baseline numbers and the amount spent so far;
- the lock was created **before the first API call**; the first commit after approval contains PREREG + the lock (proof of ordering);
- if the hash does not match → the plan was changed after the lock (UNPROVEN), the round is not accepted until it is resolved.
