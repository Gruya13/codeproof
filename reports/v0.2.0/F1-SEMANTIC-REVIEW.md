# F1 semantic review of generated tests (F1.11, process gate)

The mechanical chain proves that the trigger fails 3/3 while the control passes 3/3 under a valid environment. It does not prove that the failure is the claimed defect: that is the job of this independent semantic review, and it is a process gate, not a machine proof. Every finding that earns `execution-proven` is reviewed here before publication.

## Review checklist (per generated pair)

1. The trigger asserts the behavior described in `expectedBehavior`.
2. The control and the trigger use different inputs.
3. The assertion is not trivial or tautological.
4. The failure depends on the output of the imported function (the runner output shows the actual value).

## Reviewed artifacts

### Real run on `fixtures/mini-repo` (run `8e86b27679418946`, Node 26.8.2, $0.0601)

- **F-001 (off-by-one page slice, `src/pagination.js`)** - REVIEW PASS.
  - Control: `page([1, 2], 0, 2)` then `assert.deepEqual(result, [1, 2])` - passes 3/3.
  - Trigger: `page([1, 2, 3, 4, 5, 6], 0, 2)` then `assert.deepEqual(result, [1, 2])` - fails 3/3 with `actual: [1, 2, 3]`.
  - Inputs differ (2 items vs 6 items); the failure depends on the returned array and its length; the claim (one extra item) matches the observed actual value; no tautology, no dead code.
  - LinkCheck: `page` executed under inspector coverage (`proven`), so the result is `execution-proven`.
- Environment: `git archive` snapshot of the analyzed commit, permission-model sandbox, no network, no writes, 2 s timeout, three runs per phase.

### Mock pipeline demo (`make demo`)

The demo uses the same canned two-phase pair for the same pagination defect (`src/agents/mock.mjs`). control passes, trigger fails with `actual: [1, 2, 3], expected: [1, 2]`, LinkCheck proven - REVIEW PASS. The mock adapter supplies code only; both phases are executed locally for real.

## Limit of the chain (stated in README Limits)

`execution-proven` means: a control passed 3/3, a trigger failed 3/3 on the analyzed commit, the imported symbol actually executed (LinkCheck), and this review judged the trigger faithful to the claim. It does not re-run the repository's own test suite and it does not prove the defect is the root cause.
