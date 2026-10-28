# Extended evaluation set — injected defects in real code (frozen 28.10.2026)

| | |
|---|---|
| Repository | [axios/axios](https://github.com/axios/axios), scope `lib/` |
| Base commit | `790b5ba1d95a95e93d59b76995595c37f2b90a66` |
| Injected commit | `8c79f45314efa433ef8a62bfc4c49b1668cfe9fa` |
| Size | **74 files / 9,563 LOC** of real, production JavaScript |
| Defects | **16 injected correctness defects** (`INJ-01`..`INJ-16`) |
| Traps | **5 places that look wrong but are correct** (`TRAP-01`..`TRAP-05`) |
| Matching | reported citation must point at the expected file and overlap the defect range +/- 2 lines |
| Frozen | **before the first run**; `expected.json` carries the injection timestamp and both commit ids |

## Why this set exists

The [main benchmark](../seed-repo) is a small synthetic fixture (15 files / 229 LOC) designed to prove that the **gate** is deterministic - it is a calibration set, and it was frozen before its first run. A judge is right to ask how the pipeline behaves on real code at a realistic size. This set answers that question with the same methodology: known defects, a committed ground truth, a deterministic scorer, and every attempt reported.

It is **not** the calibration set: the scanner prompt was frozen long before this fixture was created, and this set was never used to tune anything. Results on it are reported separately and never replace the calibration numbers.

## How the set is built

The fixture is generated from a pinned clone by [`scripts/make-injected.mjs`](../../scripts/make-injected.mjs): each defect is a single `find`/`replace` pair applied to the untouched axios source, and each one is verified to apply exactly once. `expected.json` records the file and line range of every injected defect and every trap, computed from the patched source (not hand-written).

```sh
# regenerate the fixture (needs the pinned axios clone)
node scripts/make-injected.mjs \
  --source reports/probes/real/axios-lib/_repo \
  --out reports/probes/real/axios-extended \
  --expected bench/extended/expected.json
```

The defect classes are deliberate: wrong early return (`isAbsoluteURL`), missing separator (`combineURLs`), fragment slicing (`buildURL`), skipped null check (`InterceptorManager`), unawaited write (`session`), missing timer clear (`scheduler`), case-sensitive header keys (`parseHeaders`), 4xx resolve shortcut (`settle`), over-broad error classification (`isAxiosError`), trailing-call arguments (`throttle`), inverted cancellation guard (`CancelToken`), unexpanded spread (`spread`), dropped custom encoder (`buildURL`), literal `[]` key (`formDataToJSON`), space-sensitive cookie split (`cookies`), dropped response status (`transformData`).

## How to score a run

```sh
node src/cli.mjs analyze reports/probes/real/axios-extended/_repo/lib --mode smoke --out reports/probes/real/axios-extended/run-1
node scripts/score-injected.mjs --expected bench/extended/expected.json --run reports/probes/real/axios-extended/run-1
```

The scorer reports recall (defects found / 16, verified only), precision (verified findings, with traps and unmatched claims counted as false positives), L1 pass rate, trap leaks, and the per-defect status list. It writes `score.json` next to the run.

## Results

_To be filled from the frozen runs below. This file was committed before the first run; results are appended, never used to rewrite the ground truth._

| Run | Defects verified | Precision | Traps leaked | Cost |
|---|---:|---:|---:|---:|
| run-1 | _pending_ | _pending_ | _pending_ | _pending_ |
| run-2 | _pending_ | _pending_ | _pending_ | _pending_ |

## Limits

- Injected defects are authored, not naturally occurring: the set measures detection of known single-line/small-block regressions, not the discovery rate of organic bugs.
- There are 16 defects; this is a larger but still small sample. Scanner output is not bit-deterministic, so at least two runs are reported.
- The analyzed scope is `lib/`, so `lib/adapters/*` pull in third-party modules that are not installed in the snapshot; findings there can still be published (the pipeline is static), but L3 execution is only possible where the repository's own modules are directly executable.
- axios is MIT-licensed; the injected clone is generated locally and is not committed to this repository - only the ground truth and the pin are.