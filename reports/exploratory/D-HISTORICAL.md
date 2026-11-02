# Block D — historical recall re-run

**Protocol:** identical to [reports/historical/README.md](../historical/README.md) — 9 known fix commits
(6 in vercel/swr, 3 in sindresorhus/ky); check out the **parent** of the fix (the buggy state); analyze the
directory the fix changes (CodeProof, `mode: smoke`, `MAX_FINDINGS=6`); check whether a published finding cites
the same file and overlaps the lines the fix changes (automated file + range check, ±3 lines). No prompt tuning.
Every paid call went through `scripts/exp-run.sh`, attempts 21–30.

## Result: 2/9 — identical to the original run, and on the same two tests

| Test | Repo | Parent analyzed | Scope | LOC | Published | Hit |
|---|---|---|---|---:|---:|---|
| swr-c39d701 | vercel/swr | `46f3954a` | `src/_internal/utils` | 1026 | 2 | **HIT** — `cache.ts:51-60` covers the fix line 59 |
| swr-9e8b1c9d | vercel/swr | `a33fba73` | `src/subscription` | 166 | 2 | **HIT** — `index.ts:84-94` covers the fix line 93 |
| swr-87cf235d | vercel/swr | `ba10cf9e` | `src/_internal/utils` | 1006 | 2 | miss |
| swr-f8647706 | vercel/swr | `1f93cc2c` | `src/_internal/utils` | 1020 | 0 | miss |
| swr-a33fba7 | vercel/swr | `ad7b276a` | `src/index` | 1081 | 0 | miss |
| ky-85460807 | sindresorhus/ky | `3e2d81ab` | `source/core` | 1745 | 0 | miss |
| ky-8cf26e0 | sindresorhus/ky | `85460807` | `source/utils` | 929 | 0 | miss |
| ky-0f2e281 | sindresorhus/ky | `e1b088e3` | `source/utils` | 904 | 2 | miss |
| ky-91ea8a9 | sindresorhus/ky | `7c1272ba` | `source/utils` | 907 | 0 | miss |

**2/9 (22.2%) reproduced exactly.** The two hits are the same two tests as in the original run and are
verified findings with machine-checked citations; the other seven either published unrelated findings or none.
This is a reproduction of the project's weakest published number, not an improvement — and the reproduction was
run on fresh model calls (the original runs are from 27.10.), so the model variance that moved other metrics in
blocks A/B did not move this one.

## Deviations and failures (reported, not hidden)

- **Attempt 22 (`swr-9e8b1c9d`) aborted on the hard budget gate:** with `BUDGET_USD=1` the next Wonder verifier
  call (up to $0.3311) did not fit into the remaining $0.2340. The attempt is recorded as `failed` in the ledger
  (`costUsd $0.7660`), and the test was retried as attempt 23 with `BUDGET_USD=2` into `r2/`.
- **The first version of the hit checker had a bug:** it read `item.evidence` instead of
  `item.finding.evidence` (findings.json is an array of `{ finding, status, ... }`), which produced false
  "miss" results for every test. It was fixed in `scripts/exp-block-d2.mjs`, and the completed runs were
  re-checked without any new model call (the corrected records are in each run's `hit.json`; the fix is visible
  in the branch history).
- `ky-0f2e281` published 2 findings that did not overlap the fix lines — the fix changes `timeout.ts:15-31`
  while the findings cite other files/lines. A miss is reported as a miss.

## Interpretation

The historical recall is the weakest number in the published project, and this re-run reproduces it exactly.
That strengthens two things at once: the number is not an artifact of one lucky/unlucky run, and the gate's
recall on historical fixes is genuinely low (it finds the defect in ~1 of 5 known fix commits on these two
libraries under this budget). No prompt or fixture change was attempted — this is a reproduction, not a fix.

## Cost

Block D: **$3.7805** across 10 paid attempts (9 tests + 1 aborted retry). The original suite cost $1.5223; the
higher cost is explained by the larger verifier budgets (fewer budget aborts) and by the retry.
