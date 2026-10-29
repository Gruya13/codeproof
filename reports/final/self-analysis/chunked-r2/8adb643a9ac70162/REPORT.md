# CodeProof report

Commit: e77e7e0be088f8a0f50e85d805206d501b94d416  |  run-id: 8adb643a9ac70162  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 22 / 4912 |
| Import edges / cycles | 42 / 0 |
| Files in scanner prompt | 22 / 22 |
| Findings proposed | 0 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 0 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 10 / 0 |
| Tokens in / out | 77713 / 68727 |
| Cached input tokens | 9073 |
| Cost | $0.3793 |

## Verified findings

_None this run._

## Architecture

Deterministic facts only: 22 files, 4912 LOC, 42 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["agents/index.mjs"]
  n1["agents/meta.mjs"]
  n2["agents/mock.mjs"]
  n3["cli.mjs"]
  n4["config.mjs"]
  n5["ingest/index.mjs"]
  n6["mcp/index.mjs"]
  n7["patch/index.mjs"]
  n8["repro/index.mjs"]
  n9["repro/linkcheck-harness.mjs"]
  n10["repro/linkcheck.mjs"]
  n11["repro/static-checks.mjs"]
  n12["run/attest.mjs"]
  n13["run/index.mjs"]
  n14["run/json.mjs"]
  n15["run/replay.mjs"]
  n16["scan/index.mjs"]
  n17["scan/merge.mjs"]
  n18["synthesize/html.mjs"]
  n19["synthesize/index.mjs"]
  n20["verify/context.mjs"]
  n21["verify/index.mjs"]
  n0 --> n1
  n0 --> n2
  n0 --> n4
  n1 --> n4
  n3 --> n4
  n3 --> n5
  n3 --> n12
  n3 --> n8
  n3 --> n7
  n3 --> n16
  n3 --> n17
  n3 --> n21
  n3 --> n20
  n3 --> n19
  n3 --> n18
  n3 --> n14
  n3 --> n13
  n3 --> n0
  n3 --> n15
  n4 --> n16
  n4 --> n21
  n4 --> n8
  n4 --> n7
  n5 --> n13
  n6 --> n15
  n7 --> n14
  n7 --> n8
  n7 --> n13
  n8 --> n14
  n8 --> n13
  n8 --> n11
  n8 --> n10
  n15 --> n4
  n15 --> n12
  n15 --> n5
  n15 --> n21
  n15 --> n8
  n15 --> n10
  n15 --> n7
  n19 --> n13
  n21 --> n14
  n21 --> n13
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

