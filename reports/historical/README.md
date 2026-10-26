# Historical recall test - artifacts

**Question:** if we replay history - analyze the commit just before a known bug fix - does the gate find that bug?

## Protocol

For each of 9 known fix commits in two mature libraries ([vercel/swr](https://github.com/vercel/swr), [sindresorhus/ky](https://github.com/sindresorhus/ky)):

1. check out the **parent** of the fix commit (the buggy state);
2. analyze the directory of the file that the fix changes (CodeProof, `mode: smoke`, `MAX_FINDINGS=6`, bounded verifier context);
3. check whether a published finding cites the same file and **overlaps the lines the fix changes** (automated check with +/-3 line tolerance; manual adjudication when the finding cites an adjacent line of the same defect).

No prompt tuning was done for these tests; this is an honesty test of recall, not a benchmark.

## Result: 2 of 9 found, both verified

| Test | Fix commit | Parent analyzed | Scope | Result | Cost |
|---|---|---|---|---|---|
| swr-c39d701 | swr `c39d701f` | `46f3954a` | `src/_internal/utils` (1026 LOC) | **FOUND** (automated (verified)) | $0.086 |
| swr-9e8b1c9d | swr `9e8b1c9d` | `a33fba73` | `src/subscription` (166 LOC) | **FOUND** (manual (verified)) | $0.0962 |
| swr-87cf235d | swr `87cf235d` | `ba10cf9e` | `src/_internal/utils` (1006 LOC) | missed | $0.405 |
| swr-f8647706 | swr `f8647706` | `1f93cc2c` | `src/_internal/utils` (1020 LOC) | missed ([swr-f8647706/](swr-f8647706/)) | $0.6959 |
| swr-a33fba7 | swr `a33fba73` | `ad7b276a` | `src/index` (1081 LOC) | missed | $0.0386 |
| ky-85460807 | ky `85460807` | `3e2d81ab` | `source/core` (1745 LOC) | missed | $0.0538 |
| ky-8cf26e0 | ky `8cf26e0e` | `85460807` | `source/utils` (929 LOC) | missed | $0.0558 |
| ky-0f2e281 | ky `0f2e2817` | `e1b088e3` | `source/utils` (904 LOC) | missed | $0.0471 |
| ky-91ea8a9 | ky `91ea8a94` | `7c1272ba` | `source/utils` (907 LOC) | missed | $0.0439 |

- **Total measured cost: $1.5223** for the 9 tests (per-test costs above and in `RESULTS.json`).
- Both hits are `verified` findings with machine-checked citations; no false positive was published in those runs.

## The two hits

### swr `c39d701` - cache unsubscribe splice (parent `46f3954`)

Bug: `return () => subs.splice(subs.indexOf(callback), 1)` - on a double unsubscribe `indexOf` returns -1 and `splice(-1, 1)` removes an unrelated subscriber. Fix `c39d701` adds an index guard. CodeProof finding: `cache.ts:51-60`, verified, citing exactly that line. Artifacts: `swr-c39d701/` (`run.json`, `findings.json`, `REPORT.md`, `rejected.md`, `fix.diff`).

### swr `9e8b1c9d` - stale subscription cleanup (parent `a33fba7`)

Bug: on the last unsubscribe, `dispose?.()` runs but the `subscriptions` and `disposers` map entries are never removed, so internal state retains stale handles. Fix `9e8b1c9d` adds `subscriptions.delete(...)` and `disposers.delete(...)`. CodeProof finding: `index.ts:81` (`disposers.set`), verified, adjudicated manually because the fix edits the cleanup block a few lines below the citation. Artifacts: `swr-9e8b1c9d/` (+ `fix.diff`).

## Misses (7)

The other seven historical bugs were not proposed by the scanner: swr `87cf235d` (falsy `error` handling), swr `f8647706` (preload on the server), swr `a33fba7` (suspense cacheData on remount), ky `85460807` (UTF-8 JSON errors), ky `8cf26e0` (array/object merge), ky `0f2e281` (stale timeout timer), ky `91ea8a9` (search parameter merge). In two miss runs the scanner found *different* real defects (a later-fixed cache unsubscribe bug and the `INITIAL_CACHE` issue), which is why the miss runs still produced verified findings. The `swr-f8647706` run is published with its artifacts in [swr-f8647706/](swr-f8647706/): it contains the only **organic refutation** in the public record (partially refuted - see [HAND-CHECK.md](swr-f8647706/HAND-CHECK.md)) and one **uncertain** candidate caused by verifier output truncation (`finish_reason=length`).

## Honest caveats

- The analyzed commits and the upstream fixes are **public**; a model may have seen them. This is a demonstration of recall on replayable history, **not** independent discovery.
- n = 9 is small and the scope is a single directory per test.
- This is a qualitative anecdote, not a benchmark metric (benchmark metrics are in the main README).
