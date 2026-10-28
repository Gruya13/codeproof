# CodeProof report

Commit: 6e05b7637396ac66522cff8731f07cfe0ef49a29  |  run-id: d9e8ddb8b4966031  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 11 / 540 |
| Import edges / cycles | 2 / 0 |
| Files in scanner prompt | 11 / 11 |
| Findings proposed | 0 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 0 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 1 / 0 |
| Tokens in / out | 6121 / 5591 |
| Cached input tokens | 0 |
| Cost | $0.0314 |

## Verified findings

_None this run._

## Architecture

Deterministic facts only: 11 files, 540 LOC, 2 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["gtr.js"]
  n1["intersects.js"]
  n2["ltr.js"]
  n3["max-satisfying.js"]
  n4["min-satisfying.js"]
  n5["min-version.js"]
  n6["outside.js"]
  n7["simplify.js"]
  n8["subset.js"]
  n9["to-comparators.js"]
  n10["valid.js"]
  n0 --> n6
  n2 --> n6
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

