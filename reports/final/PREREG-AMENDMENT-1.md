# PREREG AMENDMENT 1 — after the independent review of the plan

**Status: LOCKED v1.1** · date 2026-10-29. · basis: `PREREG.md` v1.0 (sha256 `209b1318…f2f8fed9`)
**Reason:** independent review of the plan in two threads — **agy-verify** and **codex-verify** (2 rounds, 29.10.2026, blind input, no API calls).
**Review conclusion:** both reviewers give **AGREE WITH CONDITIONS** on a **shared list of 9 conditions**:
- round 1: codex `DISAGREE` (CX-1…CX-7), agy `AGREE WITH CONDITIONS` (AG-1…AG-7, 5 conditions);
- round 2 (exchange of findings): codex moves to `AGREE WITH CONDITIONS` with a list of 9; agy accepts all 9 ("YES, I fully agree with the other reviewer").
**Relation to the original:** `PREREG.md` is **not changed** — this amendment is the only source of changes and is read together with the original.
**Start:** execution does not begin until this amendment is locked (lock v1.1) **and** confirmed by both reviewers (§5).

## 1. Nine binding conditions (agreed unanimously)

| # | Condition | How it is applied | Where |
|---|---|---|---|
| 1 | Clones under `reports/final/` must not go into git | in `.gitignore` added `reports/final/**/_repo/` (this amendment); before Phase 1 check `git check-ignore -q reports/final/real-world/example/_repo/file.js` = exit 0; after every phase `git status --porcelain` clean | `.gitignore`, Phase 0/5 |
| 2 | Exact score paths (no "latest") | every attempt has its own `--out` directory; the run is created in `<out>/<runId>` (`src/cli.mjs` — `resolve(args.out, runId)`); score targets **that** dir; if `<out>` does not hold exactly 1 run dir → abort. Commands in §2 | §4.4, Phase 3 |
| 3 | `ablation.json` is an evidentiary exception | for held-out, `ablation.json` (+ `ABLATION.md`) applies, with `costUsd`; it enters the final manifest and the cost total; the exception to the "numbers from `run.json`" rule is explicit | §10.1, DoD 5 |
| 4 | Reproducible source for the regression pair | **picomatch:** `https://github.com/micromatch/picomatch`, pin `6bb40679c218cefba5d4e9662408c5fdf699a8bb` (tag 4.0.7), scope `lib`; **jsesc:** `https://github.com/mathiasbynens/jsesc`, pin `819f534875fd87c9033bb72148ab6a6ad1219ca0` (v3.1.0), scope = the file `jsesc.js`; reconstruction: clone + `mkdir analysis-target && cp jsesc.js analysis-target/jsesc.js`; content sha256 `03c367cbd13dc753bb8fc6c8ec3a01078c3ee142ee3f747c0490d311bc80a3b3` (byte-identical to upstream, verified); the local commit `e3349b5` is documented at that point. No run depends on an undocumented folder. | §4.5 |
| 5 | Frozen extended `_repo` | the local clone `reports/probes/real/axios-extended/_repo` is frozen at `b2c8f4c90801b6c2260a43ce7550c22868a0fb82`; deletion and reconstruction via `make-injected.mjs` are **forbidden** (it changes the SHA and dirties the frozen path); before Phase 3 a mandatory check `git -C ... rev-parse HEAD`; if it is not that SHA — extended is not measured and this is reported | §4.4 |
| 6 | Pre-lock of real-world candidates + separation of metrics | before Phase 4 lock `reports/final/REALWORLD-CANDIDATES.lock.json` (5 candidates, commits, scope, replacement order, all dry-run outcomes); initial list: `mustache`, `fast-json-patch`, `bcryptjs`, `sax`, `argparse`; replacements: `dateformat`, `accounting`, `uuid`; the DoD strictly separates new repos from the regression and bench evidence; 0-finding and refuted findings stay in the table | §4.5, DoD 7 |
| 7 | Cumulative budget ledger and executive stop | `reports/final/ATTEMPTS.jsonl` + `scripts/final-budget.mjs` (sum of all `run.json` + the manifest, `check --next-max <usd>`) + `scripts/final-run.sh` (check → run → record the attempt); **all runs individually** (`--runs 1`), never `--runs 2` in a single call; block caps in §2; stop at $35; implement in Phase 0 before the first API run | Phase 0, §5 |
| 8 | Manifest of all attempts | `ATTEMPTS.jsonl` fields: `attemptNo, block, label, startedAt, endedAt, status, costUsd, runDir, note`; an attempt that dies before `run.json` is recorded too; `runId` is **not** the key of an attempt (collision on the same revision); dedup by content sha256, not by runId | Phase 0, §10 |
| 9 | Full deterministic check after the freeze | Phase 5: on the tag `v0.2.3-final` repeat and record in `reports/final/F5-baseline.md`: Node 22/26 tests, `make integrity`, `make replay`, `make score`, `make demo`, clean-clone (tmpfs) **and** Docker `node:22-alpine`; if Docker is not available — report "not verified", never a false PASS | Phase 5 |

## 2. Revised budget — sum of caps = $40

| Block | Runs | Cap |
|---|---:|---:|
| F1 dogfood chunked + single | 2 | $6 |
| F3 calibration single ×2 | 2 | $4 |
| F3 calibration dual ×1 | 1 | $3 |
| F3 extended chunked + single | 2 | $5 |
| F3 held-out ablation | 1 | $1 |
| F4 new real-world 5 × 2 | 10 | $10 |
| F4 regression picomatch + jsesc | 2 | $2 |
| F4 dual jsesc | 1 | $2 |
| **Core** | **21** | **$33** |
| Options (three-way, controlled, historical recall) | ~5 | $2 |
| Reserve (retry/re-run after a fix) | — | $5 |
| **Total = hard cap** | | **$40** |

**Target: $35.** Rule (condition 7): before every run `node scripts/final-budget.mjs check --next-max <upper bound of the run>`; the run does not start if `spent + next-max > 40`; when `spent ≥ 35` the round stops (except the reserve for a re-run after a dogfood/freeze fix, with a note in the amendment). Per-run `BUDGET_USD` remains 2,5–5 as in the original plan.

## 3. Correction of the baseline cost (finding from the review check)

- Spent so far: **$55.8970** (all `run.json` on disk, dedup by sha256, 104 unique) respectively **$50.3643** for those tracked in git (82 files, 76 unique).
- The figure **$42.4571 from lock v1.0 was wrong**: dedup by `runId` merged different attempts of the same runId (e.g. picomatch run 1 and run 2). Corrected here — it is the same risk that condition 8 covers (`runId` is not the key of an attempt).
- This does not change the round cap ($40 for the round is independent), but it corrects the record before the first run.

## 4. Clarifications from the review (accepted, outside the 9 conditions)

- **AG-1:** clones under `reports/final/` break `clean-clone` and Phase 5 (the requirement for a clean `git status`), but not `integrity.mjs` directly (it does not check `reports/final/`) — clarified.
- **AG-4:** `jsesc/analysis-target` is committed in the local commit `e3349b5` and the old jsesc runs have `dirty=false`; the problem is portability — solved by condition 4.
- **AG-6:** 0 findings on **new** repos remains a reported failure for the new repos and is not masked by the regression pair.
- **CX-4:** Phase 5 now repeats the full DoD 2 control set (condition 9).
- The claim "no API call before the lock" is not independently provable — it remains the orchestrator's claim, confirmed by the local history (there are no API calls in this session).
- Docker clean-clone may require sudo/group; if it is not available — "not verified", without a false PASS.

## 5. Condition for starting execution

1. this amendment + lock v1.1;
2. **review round 3:** both reviewers give `AGREE` on the application list in this amendment; if someone requests a change → `PREREG-AMENDMENT-2.md` and a new agreement (at most 5 rounds in total);
3. explicit user approval to start;
4. the first API call is allowed only after 1–3.
