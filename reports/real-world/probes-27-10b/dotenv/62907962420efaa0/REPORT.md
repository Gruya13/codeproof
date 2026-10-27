# CodeProof report

Commit: c40119a1c875268a2b2331f3d70bd16677e0ef6d  |  run-id: 62907962420efaa0  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 4 / 703 |
| Import edges / cycles | 1 / 0 |
| Findings proposed | 0 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 0 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 2 / 0 |
| Tokens in / out | 15966 / 25441 |
| Cached input tokens | 0 |
| Cost | $0.1281 |

## Verified findings

_None this run._

## Architecture

Deterministic facts only: 4 files, 703 LOC, 1 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["config-options.js"]
  n1["main.d.ts"]
  n2["main.js"]
  n3["spawn-command.js"]
  n2 --> n0
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

