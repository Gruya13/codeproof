# preact probe runs - hand check

- Repository: [preactjs/preact](https://github.com/preactjs/preact) at commit `1c0f1f82340f096e5850386d617d6a3885693001` (2026-10-25, `preact@11.0.2`)
- Scope: `src/` - 17 files, 6,214 LOC; all 17/17 files fit the scanner prompt (248,961 chars, ~69k tokens)
- Runs: 2 runs on the same commit, mode `smoke`, scanner `muse-spark-1.3`, verifier `muse-wonder-1.0`, `MAX_FINDINGS=8`
- Measured: run 1 **0 findings** ($0.1341, 43 s, 1 call); run 2 **3 proposed / 1 verified / 2 uncertain** ($0.5235, 232 s, 5 calls). Total **$0.6576**.
- The analyzed code was never executed; the analysis is static.

## Finding F-001 (verified in run 2)

**Claim:** `diff()` truncates `commitQueue` on error but never truncates `refQueue`, so refs queued by the failed subtree remain and are still applied in `commitRoot`.

**Code:**
- `src/diff/index.js:102` saves `oldCommitQueueLength`; `src/diff/index.js:368` restores only `commitQueue.length` in the catch block.
- `src/diff/children.js:118-125` pushes ref triples into the shared `refQueue` while diffing children.
- `src/component.js:130-154` (`renderComponent`): the same `refQueue` array is passed to `diff()` and then to `commitRoot()` unconditionally.
- `src/diff/index.js:491-494` (`commitRoot`) applies every entry of `refQueue` with `applyRef`.

**Hand verdict: confirmed plausible defect (static), error-boundary path, not reported upstream (as of 26.10.2026).**

- The rollback is asymmetric: `commitQueue` is restored to its pre-render length, `refQueue` is not. If a render pass throws after some descendants have queued refs and an error boundary handles the error, `renderComponent` still calls `commitRoot` with the stale ref entries.
- Effect: callback refs/ref cleanups of a discarded render pass can run for components that are immediately unmounted or replaced by the boundary's fallback (out-of-order or extra ref calls).
- Hand severity: **medium-low** (requires a render error with a handling boundary and refs queued before the throw). The scanner rated it high.
- Upstream search found no matching open issue/PR (queries: refQueue, commitQueue, applyRef, refs+error boundary). The closest item is #5322 (open, "Flush effects of finished commits before a queued rerender"), which is about a different queue.
- Verification limit: preact's test environment was not installed here; no runtime reproduction, only code-level adjudication.

## The two uncertain findings (published as uncertain, not verified)

- F-002 `diff/index.js:417-419` - `_excess` suspension range handle reused; the verifier could not settle whether unmount clears it (the cited unmount evidence did not include the body).
- F-003 `diff/children.js:250-252` - `MATCHED` flag on old vnodes; the verifier could not settle whether it is reset on the throw/retry path.
- Both stay visible as uncertain; they are **not** presented as verified.

## Runs / evidence

- `run-1/`, `run-2/`: verbatim run artifacts (`run.json`, `findings.json`, `REPORT.md`, `rejected.md`, `candidates.json`)
- `probe.json`, `scope.json`: harness outputs
- The two runs are not bit-identical (0 vs 3 proposed). Both are published.

## Caveats

- Public commit; contamination is possible. Qualitative anecdote, not a benchmark metric.
- One verified finding in two runs; no recall/completeness claim.
