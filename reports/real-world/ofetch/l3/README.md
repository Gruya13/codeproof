# ofetch — L3 execution-proof run (provenance)

Two live runs of CodeProof **with L3 enabled** on [unjs/ofetch](https://github.com/unjs/ofetch) at commit `1dbc37f` (19 files / 1,470 LOC). This directory is separate from `../` (the earlier runs without L3) and exists to show that the execution proof works on real code, not only on the benchmark fixture.

| Run | Proposed | Verified | L1 rejected | Reproduced | Cost | Duration |
|---|---:|---:|---:|---:|---:|---:|
| `12ffca4e627ee488` (first, before the thrown-error prompt fix) | 3 | 1 | 2 | **0** | $0.1634 | 54.8 s |
| `12ffca4e627ee488-2` (second, current pipeline) | 3 | 2 | 1 | **1** | $0.4239 | 163 s |

## The execution-proven finding

- **Finding:** `isJSONSerializable` compares `typeof value` (a string) to `null`, so `null` falls through and `value.buffer` throws `TypeError`; the intended early-return branch can never see `null`. Cited at `src/utils.ts:21-32`.
- **Generated test:** calls `isJSONSerializable(null)` inside `try/catch`, records the thrown error, and asserts `thrown === null` plus `result === true`; also asserts the other primitive branches.
- **Runner output:** all 3 attempts fail with `AssertionError: isJSONSerializable(null) should not throw, got: TypeError: Cannot read properties of null (reading 'buffer')`.
- **Independent context:** this is the same defect as upstream [issue #571](https://github.com/unjs/ofetch/issues/571) (fixed in PRs #572/#636); the earlier hand-check of the run without L3 reached the same conclusion.
- **Why it matters:** a model-written test, executed in the sandbox, turned a semantic claim into a reproducible crash on the analyzed commit. The previous run produced a test that *did* trigger the same `TypeError` but as an uncaught runtime error, so it was correctly reported as `inconclusive`; the prompt now asks the model to convert a thrown error into an assertion failure, which made the proof explicit.

## Honest caveats

- The second run also verified a retry/`AbortSignal` claim; its reproducer was rejected at L0 because a faithful test needs `fetch` (forbidden by the sandbox), so it stayed `inconclusive` — an example of the `repro-unavailable` path, not of a failed claim.
- Two candidates were rejected at L1 in the first run and one in the second because the declared citation range and the snippet length disagreed (strict L1). That lowers recall on this repository compared with the earlier, looser gate; it is the intended trade-off and is documented in the README.
- The repository and the upstream issue are public and predate the analysis, so the model may have seen them. This is evidence that the gate surfaces real, acknowledged problems and can prove them by execution; it is not a claim of novel discovery.
- n = 2 runs, one repository, one reproduced finding. No statistical claim.

Artifacts in each run directory: `run.json`, `findings.json`, `REPORT.md`, `rejected.md`, `repro/<findingId>/test.mjs` and `result.json`.