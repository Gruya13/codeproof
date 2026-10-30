# HAND-CHECK — jsesc-dual (dual-scan, regression)

**Repo:** https://github.com/mathiasbynens/jsesc @ `e3349b542eaaf55239cb60519991b80097cee24b` · scope `analysis-target` (1 f./337 LOC)
**Run:** `1e1b03c5d8ba9776` ($1.4033, 1722 s, 2 verified **patch-proven**, per-scanner spark 1 / wonder 1 / both 0)
**Note:** the first attempt (attempt 25) failed after 900 s — the `probe-repo.mjs` spawn cap; the second attempt was measured directly through the CLI via `final-run.sh` (without the probe wrapper). Cause: Wonder scanner truncation (`finish_reason=length`) + retry at 32k tokens; a dual run takes ~29 min.

| Run / ID | Claim | Verdict | Severity | Evidence |
|---|---|---|---|---|
| F-001 `jsesc.js:221` | Negative numbers in hex/bin/oct produce invalid literals | **REAL — patch-proven** | **medium** | Same defect as jsesc-regression F-001 (and v0.2.2). The dual run found it independently; the per-scanner status shows spark 1 / wonder 1 — each model proposed one, with no overlap. |
| F-002 `jsesc.js:216-225` | The same defect described by a different claim (BigInt variant) | **REAL — patch-proven (duplicate of the same root cause)** | **medium** | The merge did not join the two findings because the claims differ; the hand-check reports them as **one root cause** (negative radix literals), not as two defects. |

**Final:** dual-scan regression confirmed; 1 root cause, 2 published entries (duplicate reported honestly). The first (failed) attempt leaves a $4 reservation in the manifest as `unknown-cost` — actual cost $0 up to the interruption; reported.
