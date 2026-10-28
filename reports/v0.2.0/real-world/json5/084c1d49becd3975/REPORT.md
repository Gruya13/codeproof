# CodeProof report

Commit: c3a75242772a5026a49c4017a16d9b3543b62776  |  run-id: 084c1d49becd3975  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 13 / 1708 |
| Import edges / cycles | 7 / 0 |
| Files in scanner prompt | 13 / 13 |
| Findings proposed | 0 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 0 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 1 / 0 |
| Tokens in / out | 23502 / 10065 |
| Cached input tokens | 0 |
| Cost | $0.0722 |

## Verified findings

_None this run._

## Architecture

Deterministic facts only: 13 files, 1708 LOC, 7 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["cli.js"]
  n1["index.d.ts"]
  n2["index.js"]
  n3["parse.d.ts"]
  n4["parse.js"]
  n5["register.js"]
  n6["require.js"]
  n7["stringify.d.ts"]
  n8["stringify.js"]
  n9["unicode.d.ts"]
  n10["unicode.js"]
  n11["util.d.ts"]
  n12["util.js"]
  n1 --> n4
  n1 --> n8
  n2 --> n4
  n2 --> n8
  n4 --> n12
  n6 --> n5
  n8 --> n12
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

