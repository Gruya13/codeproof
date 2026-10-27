# CodeProof report

Commit: f427515a38f6a671f8de663e6bcc040ed81f114e  |  run-id: 05c5c12c8485a80c  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if the deterministic citation gate (L1) passed and the adversarial verifier confirmed it. Refuted, uncertain and moderate findings are kept in separate sections - nothing is hidden, and nothing unproven is presented as verified.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 24 / 8582 |
| Import edges / cycles | 97 / 15 |
| Findings proposed | 2 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 1 |
| Moderate confidence | 0 |
| Refuted | 1 |
| Uncertain | 0 |
| Calls / retries | 6 / 0 |
| Tokens in / out | 229537 / 44903 |
| Cached input tokens | 107469 |
| Cost | $0.6781 |

## Verified findings

### F-001 - critical - uncomputeOrdinal finds first instead of last ladder entry

**Claim:** uncomputeOrdinal uses findIndex(i < ordinal) which always returns 0 for ordinal>0, so any ordinal>31 yields month 1 and day=ordinal instead of the correct month/day.

**Citation:** impl/conversions.js:40-45
```text
function uncomputeOrdinal(year, ordinal) {
  const table = isLeapYear(year) ? leapLadder : nonLeapLadder,
    month0 = table.findIndex((i) => i < ordinal),
    day = ordinal - table[month0];
  return { month: month0 + 1, day };
}
```

**Verifier (muse-wonder-1.0):** confirm - The code at impl/conversions.js:42 uses table.findIndex((i) => i < ordinal) on ladders starting with 0 at impl/conversions.js:14, so for any ordinal>0 the first element satisfies the predicate, month0 is always 0, and impl/conversions.js:43-44 therefore return month 1 with day=ordinal.

## Architecture

Deterministic facts only: 24 files, 8582 LOC, 97 import edges, 15 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["datetime.js"]
  n1["duration.js"]
  n2["errors.js"]
  n3["impl/conversions.js"]
  n4["impl/diff.js"]
  n5["impl/digits.js"]
  n6["impl/english.js"]
  n7["impl/formats.js"]
  n8["impl/formatter.js"]
  n9["impl/invalid.js"]
  n10["impl/locale.js"]
  n11["impl/regexParser.js"]
  n12["impl/tokenParser.js"]
  n13["impl/util.js"]
  n14["impl/zoneUtil.js"]
  n15["info.js"]
  n16["interval.js"]
  n17["luxon.js"]
  n18["settings.js"]
  n19["zone.js"]
  n20["zones/IANAZone.js"]
  n21["zones/fixedOffsetZone.js"]
  n22["zones/invalidZone.js"]
  n23["zones/systemZone.js"]
  n0 --> n1
  n0 --> n16
  n0 --> n18
  n0 --> n15
  n0 --> n8
  n0 --> n21
  n0 --> n10
  n0 --> n13
  n0 --> n14
  n0 --> n4
  n0 --> n11
  n0 --> n12
  n0 --> n3
  n0 --> n7
  n0 --> n2
  n0 --> n9
  n1 --> n2
  n1 --> n8
  n1 --> n9
  n1 --> n10
  n1 --> n11
  n1 --> n13
  n1 --> n18
  n1 --> n0
  n3 --> n13
  n3 --> n9
  n3 --> n2
  n4 --> n1
  n6 --> n7
  n6 --> n13
  n8 --> n6
  n8 --> n7
  n8 --> n13
  n10 --> n13
  n10 --> n6
  n10 --> n18
  n10 --> n0
  n10 --> n20
  n11 --> n13
  n11 --> n6
  n11 --> n21
  n11 --> n20
  n12 --> n13
  n12 --> n8
  n12 --> n21
  n12 --> n20
  n12 --> n0
  n12 --> n5
  n12 --> n2
  n13 --> n2
  n13 --> n18
  n13 --> n3
  n14 --> n19
  n14 --> n20
  n14 --> n21
  n14 --> n22
  n14 --> n13
  n14 --> n23
  n15 --> n0
  n15 --> n18
  n15 --> n10
  n15 --> n20
  n15 --> n14
  n15 --> n13
  n16 --> n0
  n16 --> n1
  n16 --> n18
  n16 --> n2
  n16 --> n9
  n16 --> n8
  n16 --> n7
  n16 --> n11
  n17 --> n0
  n17 --> n1
  n17 --> n16
  n17 --> n15
  n17 --> n19
  n17 --> n21
  n17 --> n20
  n17 --> n22
  n17 --> n23
  n17 --> n18
  n18 --> n23
  n18 --> n20
  n18 --> n10
  n18 --> n0
  n18 --> n14
  n18 --> n13
  n18 --> n5
  n19 --> n2
  n20 --> n13
  n20 --> n19
  n21 --> n13
  n21 --> n19
  n22 --> n19
  n23 --> n13
  n23 --> n19
  %% cycle: impl/util.js -> settings.js -> zones/systemZone.js -> impl/util.js
  %% cycle: impl/util.js -> settings.js -> zones/IANAZone.js -> impl/util.js
  %% cycle: impl/util.js -> settings.js -> impl/locale.js -> impl/util.js
  %% cycle: impl/english.js -> impl/util.js -> settings.js -> impl/locale.js -> impl/english.js
  %% cycle: settings.js -> impl/locale.js -> settings.js
  %% cycle: datetime.js -> duration.js -> impl/formatter.js -> impl/english.js -> impl/util.js -> settings.js -> impl/locale.js -> datetime.js
  %% cycle: datetime.js -> duration.js -> impl/formatter.js -> impl/english.js -> impl/util.js -> settings.js -> datetime.js
  %% cycle: impl/util.js -> settings.js -> impl/zoneUtil.js -> zones/fixedOffsetZone.js -> impl/util.js
  %% cycle: impl/util.js -> settings.js -> impl/zoneUtil.js -> impl/util.js
  %% cycle: impl/util.js -> settings.js -> impl/util.js
  %% cycle: impl/util.js -> impl/conversions.js -> impl/util.js
  %% cycle: datetime.js -> duration.js -> datetime.js
  %% cycle: datetime.js -> interval.js -> datetime.js
  %% cycle: datetime.js -> info.js -> datetime.js
  %% cycle: datetime.js -> impl/tokenParser.js -> datetime.js
```

## Limits

- Static analysis only: the analyzed code is never executed.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

