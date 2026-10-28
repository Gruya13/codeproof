# CodeProof report

Commit: 395cf7145fe28122f5a69026b310e02df114f907  |  run-id: 2be86e38745c0256  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 6 / 4193 |
| Import edges / cycles | 8 / 0 |
| Files in scanner prompt | 6 / 6 |
| Findings proposed | 1 |
| Rejected at L1 (bad citation) | 1 |
| Verified | 0 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 1 / 0 |
| Tokens in / out | 41616 / 8500 |
| Cached input tokens | 41585 |
| Cost | $0.0424 |

## Verified findings

_None this run._

## Architecture

Deterministic facts only: 6 files, 4193 LOC, 8 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["argument.js"]
  n1["command.js"]
  n2["error.js"]
  n3["help.js"]
  n4["option.js"]
  n5["suggestSimilar.js"]
  n0 --> n2
  n1 --> n0
  n1 --> n2
  n1 --> n3
  n1 --> n4
  n1 --> n5
  n3 --> n0
  n4 --> n2
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

