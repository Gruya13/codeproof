# CodeProof report

Commit: 2455ac8212fe66bc3248aa01186a52c27c87da5a  |  run-id: e8eea43af88affea  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 51 / 8485 |
| Import edges / cycles | 157 / 0 |
| Files in scanner prompt | 51 / 51 |
| Findings proposed | 3 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 3 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 7 / 0 |
| Tokens in / out | 105143 / 30910 |
| Cached input tokens | 0 |
| Cost | $0.5961 |

## Verified findings

### F-001 - high - fromJSON throws for Document type

**Claim:** fromJSON cannot rehydrate Document nodes: it handles root/decl/rule/comment/atrule but throws for type document even though Document with type document exists.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** inconclusive: test did not demonstrate the claim consistently

**Citation (from commit, lines 38-50):** fromJSON.js
```text
  if (defaults.type === 'root') {
    node = new Root(defaults)
  } else if (defaults.type === 'decl') {
    node = new Declaration(defaults)
  } else if (defaults.type === 'rule') {
    node = new Rule(defaults)
  } else if (defaults.type === 'comment') {
    node = new Comment(defaults)
  } else if (defaults.type === 'atrule') {
    node = new AtRule(defaults)
  } else {
    throw new Error('Unknown node type: ' + json.type)
  }
```

**Verifier (muse-wonder-1.0):** confirm - fromJSON.js:38-50 branches only on root/decl/rule/comment/atrule and throws 'Unknown node type' in the else branch, while postcss.js:8 and postcss.js:82-88 require, export, and instantiate a Document class, so a type 'document' payload hits the throw.

### F-002 - medium - showSourceCode NaN when endColumn undefined

**Claim:** Long-line truncation computes subLineEnd with this.endColumn + padding without guarding undefined, producing NaN and an empty snippet when error has no range.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** inconclusive: test did not demonstrate the claim consistently

**Citation (from commit, lines 79-85):** css-syntax-error.js
```text
          if (line.length > 160) {
            let padding = 20
            let subLineStart = Math.max(0, this.column - padding)
            let subLineEnd = Math.max(
              this.column + padding,
              this.endColumn + padding
            )
```

**Verifier (muse-wonder-1.0):** confirm - Confirmed: css-syntax-error.js:22-25 sets only line/column for numeric arguments leaving endColumn undefined, and css-syntax-error.js:82-86 computes Math.max(this.column+padding, this.endColumn+padding) unguarded, so undefined+padding yields NaN, Math.max yields NaN, and line.slice(subLineStart, NaN) yields an empty truncated line.

### F-003 - medium - NoWorkResult toString bypasses processed css

**Claim:** NoWorkResult.toString returns raw _css while css getter returns result.css which was stripped/updated via MapGenerator, so string coercion diverges from css.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** inconclusive: test did not demonstrate the claim consistently

**Citation (from commit, lines 14-16):** no-work-result.js
```text
  get css() {
    return this.result.css
  }
```
**Citation (from commit, lines 89-92):** no-work-result.js
```text
    } else {
      map.clearAnnotation()
      this.result.css = map.css
    }
```
**Citation (from commit, lines 127-129):** no-work-result.js
```text
  toString() {
    return this._css
  }
```

**Verifier (muse-wonder-1.0):** confirm - Confirmed: NoWorkResult.css returns this.result.css at no-work-result.js:14, which is overwritten from MapGenerator output at no-work-result.js:80 and no-work-result.js:89, while toString() returns the unmodified this._css at no-work-result.js:127.

## Architecture

Deterministic facts only: 51 files, 8485 LOC, 157 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["at-rule.d.ts"]
  n1["at-rule.js"]
  n2["comment.d.ts"]
  n3["comment.js"]
  n4["container.d.ts"]
  n5["container.js"]
  n6["css-syntax-error.d.ts"]
  n7["css-syntax-error.js"]
  n8["declaration.d.ts"]
  n9["declaration.js"]
  n10["document.d.ts"]
  n11["document.js"]
  n12["fromJSON.d.ts"]
  n13["fromJSON.js"]
  n14["input.d.ts"]
  n15["input.js"]
  n16["lazy-result.d.ts"]
  n17["lazy-result.js"]
  n18["list.d.ts"]
  n19["list.js"]
  n20["map-generator.js"]
  n21["no-work-result.d.ts"]
  n22["no-work-result.js"]
  n23["node.d.ts"]
  n24["node.js"]
  n25["parse.d.ts"]
  n26["parse.js"]
  n27["parser.js"]
  n28["postcss.d.ts"]
  n29["postcss.js"]
  n30["postcss.mjs"]
  n31["previous-map.d.ts"]
  n32["previous-map.js"]
  n33["processor.d.ts"]
  n34["processor.js"]
  n35["result.d.ts"]
  n36["result.js"]
  n37["root.d.ts"]
  n38["root.js"]
  n39["rule.d.ts"]
  n40["rule.js"]
  n41["stringifier.d.ts"]
  n42["stringifier.js"]
  n43["stringify.d.ts"]
  n44["stringify.js"]
  n45["symbols.js"]
  n46["terminal-highlight.js"]
  n47["tokenize.js"]
  n48["warn-once.js"]
  n49["warning.d.ts"]
  n50["warning.js"]
  n0 --> n5
  n1 --> n5
  n2 --> n5
  n2 --> n24
  n3 --> n24
  n4 --> n1
  n4 --> n3
  n4 --> n9
  n4 --> n24
  n4 --> n29
  n4 --> n40
  n5 --> n3
  n5 --> n9
  n5 --> n24
  n5 --> n45
  n6 --> n15
  n7 --> n46
  n8 --> n5
  n8 --> n24
  n9 --> n24
  n10 --> n5
  n10 --> n29
  n10 --> n36
  n10 --> n38
  n11 --> n5
  n12 --> n29
  n13 --> n1
  n13 --> n3
  n13 --> n9
  n13 --> n15
  n13 --> n32
  n13 --> n38
  n13 --> n40
  n14 --> n29
  n14 --> n32
  n15 --> n7
  n15 --> n32
  n15 --> n46
  n16 --> n11
  n16 --> n29
  n16 --> n34
  n16 --> n36
  n16 --> n38
  n16 --> n50
  n17 --> n5
  n17 --> n11
  n17 --> n20
  n17 --> n26
  n17 --> n36
  n17 --> n38
  n17 --> n44
  n17 --> n45
  n17 --> n48
  n20 --> n15
  n21 --> n17
  n21 --> n29
  n21 --> n34
  n21 --> n36
  n21 --> n38
  n21 --> n50
  n22 --> n20
  n22 --> n26
  n22 --> n36
  n22 --> n44
  n22 --> n48
  n23 --> n1
  n23 --> n1
  n23 --> n1
  n23 --> n3
  n23 --> n5
  n23 --> n7
  n23 --> n9
  n23 --> n11
  n23 --> n15
  n23 --> n29
  n23 --> n36
  n23 --> n38
  n23 --> n40
  n23 --> n50
  n24 --> n7
  n24 --> n42
  n24 --> n44
  n24 --> n45
  n25 --> n29
  n26 --> n5
  n26 --> n15
  n26 --> n27
  n27 --> n1
  n27 --> n3
  n27 --> n9
  n27 --> n38
  n27 --> n40
  n27 --> n47
  n28 --> n1
  n28 --> n3
  n28 --> n5
  n28 --> n7
  n28 --> n9
  n28 --> n11
  n28 --> n15
  n28 --> n17
  n28 --> n19
  n28 --> n24
  n28 --> n34
  n28 --> n36
  n28 --> n38
  n28 --> n40
  n28 --> n50
  n29 --> n1
  n29 --> n3
  n29 --> n5
  n29 --> n7
  n29 --> n9
  n29 --> n11
  n29 --> n13
  n29 --> n15
  n29 --> n17
  n29 --> n19
  n29 --> n24
  n29 --> n26
  n29 --> n34
  n29 --> n36
  n29 --> n38
  n29 --> n40
  n29 --> n44
  n29 --> n50
  n30 --> n29
  n31 --> n29
  n33 --> n11
  n33 --> n17
  n33 --> n22
  n33 --> n29
  n33 --> n36
  n33 --> n38
  n34 --> n11
  n34 --> n17
  n34 --> n22
  n34 --> n38
  n35 --> n29
  n35 --> n34
  n36 --> n50
  n37 --> n5
  n37 --> n11
  n37 --> n29
  n37 --> n36
  n38 --> n5
  n39 --> n5
  n40 --> n5
  n40 --> n19
  n41 --> n29
  n43 --> n29
  n44 --> n42
  n46 --> n47
  n49 --> n7
  n49 --> n24
  n50 --> n5
  n50 --> n45
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

