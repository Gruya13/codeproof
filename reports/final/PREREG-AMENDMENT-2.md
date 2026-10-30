# PREREG AMENDMENT 2 — closing the findings from round 3

**Status: LOCKED v1.2** · date 2026-10-29. · basis: `PREREG.md` v1.0 + `PREREG-AMENDMENT-1.md` (v1.1)
**Reason:** round 3 confirming amendment v1.1: **agy = AGREE** (no findings), **codex = DISAGREE** with 3 findings (R3-CX-A..C) and one addendum (D). This amendment closes them; the agreement from round 2 remains in force.
**Relation to the previous files:** the original plan and AMENDMENT-1 are **not changed**; this file is a supplement that is read together with them.

## 1. R3-CX-A (P1) — concrete score commands (changes PREREG §4.4 and AMENDMENT-1 condition 2)

The scoring command **never** gets the parent `--out` directory and never picks the "latest" one:

```bash
score_run() {
  OUT="$1"
  N=$(find "$OUT" -mindepth 1 -maxdepth 1 -type d | wc -l)
  [ "$N" -eq 1 ] || { echo "ABORT: $OUT has $N run dirs (expected exactly 1)"; exit 1; }
  RUN=$(find "$OUT" -mindepth 1 -maxdepth 1 -type d)
  node bench/score.mjs --run "$RUN"
}
score_run reports/final/bench-calibration/single-1
score_run reports/final/bench-calibration/single-2
score_run reports/final/bench-calibration/dual
```

Extended (same principle; the run dir is `<out>/<runId>`):

```bash
score_injected_dir() {
  OUT="$1"
  N=$(find "$OUT" -mindepth 1 -maxdepth 1 -type d | wc -l)
  [ "$N" -eq 1 ] || { echo "ABORT: $OUT has $N run dirs"; exit 1; }
  node scripts/score-injected.mjs --expected bench/extended/expected.json --run "$(find "$OUT" -mindepth 1 -maxdepth 1 -type d)"
}
score_injected_dir reports/final/bench-extended/single
score_injected_dir reports/final/bench-extended/chunked
```

- The command `node bench/score.mjs --run reports/final/bench-calibration/single-1` from PREREG §4.4 **is replaced** by this rule.
- Abort if `<out>` does not hold exactly one run directory. Forbidden: "latest", `ls -t | head`, manual picking.

## 2. R3-CX-B (P1) — jsesc reconstruction with a commit step (changes AMENDMENT-1 condition 4)

- Public source: `https://github.com/mathiasbynens/jsesc`, pin `819f534875fd87c9033bb72148ab6a6ad1219ca0` (v3.1.0).
- **The scope for the run is the `analysis-target` directory** (not a file). The reconstruction must include the commit, because ingest reads the content from the analyzed commit (`src/ingest/index.mjs` — `readFileAtCommit`):

```bash
git clone https://github.com/mathiasbynens/jsesc.git jsesc-regression
git -C jsesc-regression checkout 819f534875fd87c9033bb72148ab6a6ad1219ca0
mkdir -p jsesc-regression/analysis-target
cp jsesc-regression/jsesc.js jsesc-regression/analysis-target/jsesc.js
git -C jsesc-regression add analysis-target/jsesc.js
git -C jsesc-regression -c user.name=codeproof -c user.email=codeproof@local commit -m "analysis scope: jsesc.js"
git -C jsesc-regression rev-parse HEAD          # SHA is written into REALWORLD-CANDIDATES.lock.json
sha256sum jsesc-regression/analysis-target/jsesc.js
# expected: 03c367cbd13dc753bb8fc6c8ec3a01078c3ee142ee3f747c0490d311bc80a3b3
```

- Before every regression jsesc run, mandatory checks: `git -C <clone> rev-parse HEAD` = the recorded SHA **and** `git -C <clone> status --porcelain -- analysis-target` empty (dirty=false).
- The existing local clone `real-world/jsesc` (commit `e3349b5`) is a valid source **if** those two checks pass; otherwise the reconstruction above is used.
- Picomatch: `--repo https://github.com/micromatch/picomatch --commit 6bb40679c218cefba5d4e9662408c5fdf699a8bb --scope lib` — public pin, no local dependencies.

## 3. R3-CX-C (P0) — budget reservation for unknown cost (changes AMENDMENT-1 conditions 7 and 8)

**Problem:** if an API call bills tokens and the run dies before writing `run.json`, a ledger that sums only `run.json` does not see that cost → the actual total may exceed $40.

**Solution — reserve before the call, settle after:**

1. **Before every API run:** `node scripts/final-budget.mjs reserve --attempt <n> --max <BUDGET_USD>` writes into `ATTEMPTS.jsonl` the line `{attemptNo, block, label, startedAt, status:"reserved", reservedUsd:<BUDGET_USD>, costUsd:null, runDir:null}`; before writing it checks `spentEffective + reservedUsd <= 40`, otherwise abort.
2. **After the run:** `settle --attempt <n>`:
   - if `run.json` was created → `costUsd = run.json.usage.costUsd`, `status:"ok"|"failed"`, `runDir` filled;
   - if `run.json` was **not** created → `status:"unknown-cost"`, `costUsd:null`, **`reservedUsd` stays in the calculation** until the actual cost is entered by hand from the API call/log; it is never deleted and never estimated at zero.
3. **`spentEffective = Σ costUsd (settled) + Σ reservedUsd (open/unknown-cost)** — the ledger **never underestimates**.
4. `check --next-max <usd>`: `spentEffective + next-max <= 40`, otherwise abort; if `spentEffective >= 35` → stop the round (except the reserve for a re-run after a fix, with a note in the amendment).
5. `run.json` and `ATTEMPTS.jsonl` are not summed twice: one attempt = one line in the manifest; `run.json` only serves to settle that line.

## 4. R3-CX-D (P1) — manifest of attempts (changes AMENDMENT-1 condition 8)

`reports/final/ATTEMPTS.jsonl`, one JSON object per line, fields:
`attemptNo` (incremental 1,2,3… without gaps), `block`, `label`, `startedAt`, `endedAt` (null while running), `status` (`reserved|started|ok|failed|aborted|unknown-cost`), `reservedUsd`, `costUsd` (null while unknown), `runDir` (or null), `note`.
- Deleting a line creates a gap in the numbering → the verifier reports FAIL.
- `runId` is not the key of an attempt (collision of the same runId on the same revision); dedup only by the content sha256 of `run.json`.
- The manifest is the single source of truth for the total; `run.json` gives the exact amount per attempt.

## 5. Other

- **agy (round 3):** no findings, `AGREE` — the agreement from round 2 is not weakened.
- **Editorial correction:** the reference "Commands in §2" from AMENDMENT-1 condition 2 refers to **§1 of this amendment** (in AMENDMENT-1 §2 there is the budget table).
- The implementation of `scripts/final-budget.mjs` and `scripts/final-run.sh` is part of Phase 0, **before the first API call**; their output is committed before Phase 1.

## 6. Lock v1.2 and round 4

- the new lock contains the sha256 for `PREREG.md` (unchanged), `AMENDMENT-1` (unchanged) and this file;
- round 4 of confirmation: codex checks that R3-CX-A..D are resolved, agy checks that the agreement is not weakened; if both give `AGREE`, the round can start after user approval.
