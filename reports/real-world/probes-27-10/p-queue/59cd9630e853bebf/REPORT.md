# CodeProof report

Commit: 7f272ab5ff2254c0dc2537b7977e88ede1cd55e8  |  run-id: 59cd9630e853bebf  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 5 / 1640 |
| Import edges / cycles | 11 / 1 |
| Findings proposed | 0 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 0 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 1 / 0 |
| Tokens in / out | 19238 / 11435 |
| Cached input tokens | 0 |
| Cost | $0.0726 |

## Verified findings

_None this run._

## Architecture

Deterministic facts only: 5 files, 1640 LOC, 11 import edges, 1 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["index.ts"]
  n1["lower-bound.ts"]
  n2["options.ts"]
  n3["priority-queue.ts"]
  n4["queue.ts"]
  n0 --> n4
  n0 --> n3
  n0 --> n2
  n0 --> n4
  n0 --> n3
  n0 --> n2
  n2 --> n4
  n2 --> n3
  n3 --> n4
  n3 --> n1
  n3 --> n2
  %% cycle: priority-queue.ts -> options.ts -> priority-queue.ts
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

