# Extended evaluation set — injected defects in real code (frozen 28.10.2026)

| | |
|---|---|
| Repository | [axios/axios](https://github.com/axios/axios), scope `lib/` |
| Base commit | `790b5ba1d95a95e93d59b76995595c37f2b90a66` |
| Injected commit | `8c79f45314efa433ef8a62bfc4c49b1668cfe9fa` |
| Size | **74 files / 9,564 LOC** (as ingested) of real, production JavaScript |
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

Four runs on the frozen fixture, all of them reported (no run was discarded). `run-1`/`run-2` used the default `MAX_FINDINGS=8`; `run-3`/`run-4` used `MAX_FINDINGS=20` to check whether the candidate cap, not the model, was limiting recall - it was not (the model produced 8-9 candidates either way).

| Run | Candidates | Defects verified | Precision (verified) | Traps leaked | L1 pass | Execution proofs | Cost | Duration |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| run-1 (`MAX_FINDINGS=8`) | 8 | **4/16 (25%)** | 100% | 0/5 | 4/8 | 3 | $0.5291 | 97 s |
| run-2 (`MAX_FINDINGS=8`) | 8 | **7/16 (43.8%)** | 100% | 0/5 | 7/8 | 5 | $0.7808 | 142 s |
| run-3 (`MAX_FINDINGS=20`) | 9 | **6/16 (37.5%)** | 85.7% (1 FP) | 0/5 | 7/9 | 4 | $0.8476 | 146 s |
| run-4 (`MAX_FINDINGS=20`) | 8 | **7/16 (43.8%)** | 100% | 0/5 | 7/8 | 5 | $0.8640 | 160 s |

Mean verified recall **6.0/16 (37.5%)**, mean cost **$0.755**, mean duration 136 s. **No trap was ever published (0/20 across runs)**, and precision was 100% in three of four runs.

### Reading

- **Real code is much harder than the calibration fixture.** The scanner found 4-7 of 16 subtle injected defects; the calibration fixture's 8/8 does not transfer to production code of this size. This is the honest number and it is the reason this set exists.
- **When the pipeline publishes, it is almost always right.** Four runs produced 28 published findings, of which one was a false positive (a verified claim not on any injected defect) and none landed on a trap. The gate is conservative, not permissive.
- **The model proposes roughly the same number of candidates regardless of the cap**, so the low recall is a scanner limitation, not a `MAX_FINDINGS` artifact. A larger `MAX_FINDINGS` did not help (`run-3`/`run-4`).
- **L1 still earns its place:** in `run-1`, four of eight candidates cited the wrong lines and were rejected deterministically before any model verification.

## Recall experiments (post-freeze, same ground truth)

After the set was published, the recall levers were measured against the same frozen ground truth. No ground truth, prompt or threshold was changed; these are pipeline variants.

| Variant | Defects verified | Precision vs ground truth | Traps leaked | Cost |
|---|---:|---:|---:|---:|
| single-pass scanner (4 runs) | 4, 7, 6, 7 / 16 - **mean 37.5%** | 85.7-100% | 0/5 | $0.53-0.86 |
| **dual-scanner** (both models scan) | 7/16 (43.8%) | 87.5% (1 FP) | **1/5** | $2.52 |
| **chunked scan** (one call per directory) | 10/16, 9/16 - **mean 59.4%** | 71.4%, 75.0% | 0/5 | $2.31, $1.85 |

Reading:

- **Chunked scanning is the effective recall lever.** The scanner recall measured before verification went from 8/16 (50%) to **11/16 (68.8%)** in one chunked scan at $0.245, and the full chunked pipeline verified 9-10/16 versus 4-7/16 for single-pass. The reason is context focus: each call sees one directory instead of all 74 files. The scanner-only measurement is committed as [reports/chunked-scan/lib-b2c8f4c-mvrsqyl6/chunked-scan.json](../../reports/chunked-scan/lib-b2c8f4c-mvrsqyl6/chunked-scan.json).
- **The dual scanner does not help on this set.** It produced one extra candidate but the same verified recall, cost 3.5x, and leaked one trap (a finding the verifier confirmed on a place that is actually correct). Cross-model verification does not compensate for a context that is too broad.
- **The two chunked runs published 4 and 3 findings that are not among the injected defects** (in `utils.js` and `AxiosHeaders.js`); the scorer counts them as precision errors against the frozen set. One of them is a real bug: `utils.matchAll` can loop forever on a regex that matches an empty string (`while ((matches = regExp.exec(str)) !== null)` never advances `lastIndex` for a zero-length match). It is published as a genuine extra finding, exactly like the calibration set's pre-registered extras - the scorer simply has no ground-truth entry for it.
- **`MAX_FINDINGS` is not the limiter** (the model proposed 8-14 candidates either way), and the candidate cap change from 8 to 20 moved recall only through the chunked variant.

## Limits

- Injected defects are authored, not naturally occurring: the set measures detection of known single-line/small-block regressions, not the discovery rate of organic bugs.
- There are 16 defects; this is a larger but still small sample. Scanner output is not bit-deterministic, so at least two runs are reported.
- The analyzed scope is `lib/`, so `lib/adapters/*` pull in third-party modules that are not installed in the snapshot; findings there can still be published (the pipeline is static), but L3 execution is only possible where the repository's own modules are directly executable.
- axios is MIT-licensed; the injected clone is generated locally and is not committed to this repository - only the ground truth and the pin are.