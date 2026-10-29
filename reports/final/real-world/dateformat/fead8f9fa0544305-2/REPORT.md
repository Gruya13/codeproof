# CodeProof report

Commit: e6800aa902fcbd523d5ea06a9a79050878cfa48e  |  run-id: fead8f9fa0544305  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 43 / 2085 |
| Import edges / cycles | 1 / 0 |
| Files in scanner prompt | 43 / 43 |
| Findings proposed | 1 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 1 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 3 / 0 |
| Tokens in / out | 38437 / 16392 |
| Cached input tokens | 0 |
| Cost | $0.1945 |

## Verified findings

### F-001 - medium - yyyy token mis-formats negative years

**Claim:** yyyy uses pad(y(),4) without handling negative years, so String(-1).padStart(4,'0') produces '00-1' with the minus sign in the middle instead of a sign-prefixed zero-padded year. yy correctly uses Math.abs but yyyy does not.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** inconclusive: reproducer failed L0: controlCode: forbidden non-deterministic Date construction (use fixed values instead); testCode: forbidden non-deterministic Date construction (use fixed values instead); control and trigger must use a different input: control and trigger call the shared symbol(s) with identical arguments

**Citation (from commit, lines 98-99):** src/dateformat.js
```text
    yy: () => pad(Math.abs(y()), 2).slice(-2),
    yyyy: () => pad(y(), 4),
```
**Citation (from commit, lines 221-221):** src/dateformat.js
```text
const pad = (val, len = 2) => String(val).padStart(len, '0');
```

**Verifier (muse-wonder-1.0):** confirm - Confirmed: src/dateformat.js:99 defines yyyy as pad(y(),4) without Math.abs unlike yy at src/dateformat.js:98, and pad at src/dateformat.js:221 is String(val).padStart(len,'0'), so a negative year from getFullYear at src/dateformat.js:65 such as -1 yields '00-1'.

## Architecture

Deterministic facts only: 43 files, 2085 LOC, 1 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0[".mocharc.cjs"]
  n1["benchmark/benchmark.js"]
  n2["benchmark/previousDateFormat.js"]
  n3["src/dateformat.js"]
  n4["test/test_dayofweek.js"]
  n5["test/test_formats.js"]
  n6["test/test_isoutcdatetime.js"]
  n7["test/test_mask-d.js"]
  n8["test/test_mask-dd.js"]
  n9["test/test_mask-ddd.js"]
  n10["test/test_mask-dddd.js"]
  n11["test/test_mask-h.js"]
  n12["test/test_mask-h_.js"]
  n13["test/test_mask-h_h_.js"]
  n14["test/test_mask-hh.js"]
  n15["test/test_mask-l.js"]
  n16["test/test_mask-l_.js"]
  n17["test/test_mask-m.js"]
  n18["test/test_mask-m_.js"]
  n19["test/test_mask-m_m_.js"]
  n20["test/test_mask-mm.js"]
  n21["test/test_mask-mmm.js"]
  n22["test/test_mask-mmmm.js"]
  n23["test/test_mask-n_.js"]
  n24["test/test_mask-o.js"]
  n25["test/test_mask-p.js"]
  n26["test/test_mask-s.js"]
  n27["test/test_mask-s_.js"]
  n28["test/test_mask-ss.js"]
  n29["test/test_mask-t.js"]
  n30["test/test_mask-t_.js"]
  n31["test/test_mask-t_t_.js"]
  n32["test/test_mask-tt.js"]
  n33["test/test_mask-w_.js"]
  n34["test/test_mask-ww_.js"]
  n35["test/test_mask-yy.js"]
  n36["test/test_mask-yyyy.js"]
  n37["test/test_mask-z_.js"]
  n38["test/test_quotes.js"]
  n39["test/test_threedays.js"]
  n40["test/test_utc-threedays.js"]
  n41["test/test_utc-week.js"]
  n42["test/weekofyear/test_weekofyear.js"]
  n1 --> n2
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

