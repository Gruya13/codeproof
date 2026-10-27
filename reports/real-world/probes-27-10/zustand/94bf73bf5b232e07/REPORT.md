# CodeProof report

Commit: 382d29c485e67018c06e75ec7235130d0968522c  |  run-id: 94bf73bf5b232e07  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 16 / 1468 |
| Import edges / cycles | 23 / 0 |
| Findings proposed | 0 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 0 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 1 / 0 |
| Tokens in / out | 15270 / 8784 |
| Cached input tokens | 0 |
| Cost | $0.0564 |

## Verified findings

_None this run._

## Architecture

Deterministic facts only: 16 files, 1468 LOC, 23 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["index.ts"]
  n1["middleware.ts"]
  n2["middleware/combine.ts"]
  n3["middleware/devtools.ts"]
  n4["middleware/immer.ts"]
  n5["middleware/persist.ts"]
  n6["middleware/redux.ts"]
  n7["middleware/ssrSafe.ts"]
  n8["middleware/subscribeWithSelector.ts"]
  n9["react.ts"]
  n10["react/shallow.ts"]
  n11["shallow.ts"]
  n12["traditional.ts"]
  n13["types.d.ts"]
  n14["vanilla.ts"]
  n15["vanilla/shallow.ts"]
  n0 --> n14
  n0 --> n9
  n1 --> n6
  n1 --> n3
  n1 --> n8
  n1 --> n2
  n1 --> n5
  n1 --> n7
  n2 --> n14
  n3 --> n14
  n4 --> n14
  n5 --> n14
  n6 --> n14
  n6 --> n3
  n7 --> n14
  n8 --> n14
  n9 --> n14
  n9 --> n14
  n10 --> n15
  n11 --> n15
  n11 --> n10
  n12 --> n14
  n12 --> n14
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

