# Independent review of the plan — process record (6 rounds)

**Result: AGREEMENT REACHED.** Both reviewers gave **AGREE** in round 6 on the locked plan (`PREREG.md` v1.0 + `AMENDMENT-1..4`, `PREREG.lock.json` v1.5).

| | agy-verify | codex-verify |
|---|---|---|
| Round 1 | AGREE WITH CONDITIONS (AG-1..7, 5 conditions) | DISAGREE (CX-1..7) |
| Round 2 | accepted the shared list of 9 conditions | moved to AGREE WITH CONDITIONS (9 conditions) |
| Round 3 | AGREE on A1 | DISAGREE (3 findings: score, jsesc, reservation) |
| Round 4 | AGREE WITH CONDITIONS (3 items) | DISAGREE (the same 3 + 2 addenda) |
| Round 5 | AGREE on A3 | DISAGREE (1 P0: `costUsd` validation) |
| Round 6 | **AGREE** on A4 | **AGREE** on A4 |

**Total:** 6 rounds, 13 calls (agy 7 — one interrupted by a timeout in round 1 and repeated; codex 6). Blind input: the reviewers did not receive the orchestrator reasoning, only the plan, the artifacts and the other reviewer's findings in the exchange rounds. No API call to the Muse models was made.

## What was agreed (built in through A1–A4)

1. **9 shared conditions** (A1): gitignore for the clones, exact score commands, the `ablation.json` evidentiary exception, reproducible pins for the regression pair, frozen extended `_repo`, pre-lock of the real-world candidates, a cumulative budget ledger, a manifest of all attempts, a full deterministic check after the freeze.
2. **Executable commands and pins** (A2): concrete score commands without "latest"; jsesc reconstruction with a commit step and sha256; budget reservation before the call; manifest fields.
3. **Hermetic budget** (A3): the `hardBudget` fix in the ablation + test; settle from `ablation.json`; a git commit of the reservation **before** every API call; blocking of dangling reservations; artifact audit.
4. **Cost validation** (A4): `settle` accepts only `measured:true` + a finite non-negative number; everything else is `unknown-cost` with a permanent reservation + 9 mandatory test cases.

## Corrections that the review found

- **Baseline cost:** the old $42.4571 was wrong (dedup by `runId` merged different attempts) → **$55.8970** in total / **$50.3643** git-tracked.
- **The sum of caps** was $43 > $40 → now exactly **$40** (target $35).
- **The `make bench` score command** from the original plan would have failed with ENOENT (the run is created in `<out>/<runId>`).
- **The hard cap was not guaranteed** for an ablation run (hard budget was not passed through) nor for a run that dies before `run.json`.
- **Jsesc regression** was not reproducible without the commit step (the scope is not a directory in the commit).

## Obligations for Phase 0 (before the first API call)

- [ ] commit of the locked plan (PREREG + A1–A4 + lock v1.5);
- [ ] `hardBudget` fix in `scripts/ablation.mjs` + regression test (test-lock, author = assistant);
- [ ] implementation of `scripts/final-budget.mjs` + `scripts/final-run.sh` with the A4 validation and the 9 test cases from A4 §3 (include `costUsd: 0, measured:false` and NaN/Infinity in the validator — codex r6 refinement);
- [ ] verification of `.gitignore` (`git check-ignore`) and a dry run of the wrapper on a mock run ($0);
- [ ] deterministic control pass (Node 22/26, integrity, replay, score, demo, clean-clone ×2);
- [ ] move to Phase 1 (dogfood) — the first real API run.
