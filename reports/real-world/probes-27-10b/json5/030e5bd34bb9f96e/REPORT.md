# CodeProof report

Commit: 307a03f7535b05141c44921a1b155cd32ba1b665  |  run-id: 030e5bd34bb9f96e  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 7 / 1795 |
| Import edges / cycles | 6 / 0 |
| Findings proposed | 0 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 0 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 1 / 0 |
| Tokens in / out | 26640 / 7436 |
| Cached input tokens | 0 |
| Cost | $0.0649 |

## Verified findings

_None this run._

## Architecture

Deterministic facts only: 7 files, 1795 LOC, 6 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["cli.js"]
  n1["index.d.ts"]
  n2["index.js"]
  n3["parse.js"]
  n4["stringify.js"]
  n5["unicode.js"]
  n6["util.js"]
  n0 --> n2
  n2 --> n3
  n2 --> n4
  n3 --> n6
  n4 --> n6
  n6 --> n5
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

