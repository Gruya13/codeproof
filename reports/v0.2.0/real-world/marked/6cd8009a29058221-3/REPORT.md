# CodeProof report

Commit: b4eb83bbb48107720d95162ccecf829ba16be91e  |  run-id: 6cd8009a29058221  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 13 / 3344 |
| Import edges / cycles | 67 / 11 |
| Files in scanner prompt | 13 / 13 |
| Findings proposed | 1 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 1 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 3 / 0 |
| Tokens in / out | 47656 / 19647 |
| Cached input tokens | 500 |
| Cost | $0.2550 |

## Verified findings

### F-001 - high - Lexer.lex appends to stale instance tokens on reuse

**Claim:** Lexer.lex reuses the same instance field this.tokens without clearing it, so a second lex() call on the same _Lexer instance appends new block tokens and links to the previous result instead of starting fresh, double-counting output.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** inconclusive: reproducer failed L0: controlCode assertion is not tied to a call of an imported symbol; testCode assertion is not tied to a call of an imported symbol; control and trigger must use a different input: control and trigger call the shared symbol(s) with identical arguments

**Citation (from commit, lines 22-25):** Lexer.ts
```text
  constructor(options?: MarkedOptions) {
    // TokenList cannot be created in one go
    this.tokens = [] as unknown as TokensList;
    this.tokens.links = Object.create(null);
```
**Citation (from commit, lines 87-99):** Lexer.ts
```text
  lex(src: string) {
    src = src.replace(other.carriageReturn, '\n');

    this.blockTokens(src, this.tokens);

    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];

    return this.tokens;
  }
```

**Verifier (muse-wonder-1.0):** confirm - Lexer.ts:22 initializes this.tokens once in the constructor and Lexer.ts:87 passes that same this.tokens to blockTokens and returns it without any reset, so a second instance lex() call appends to the prior array.

## Architecture

Deterministic facts only: 13 files, 3344 LOC, 67 import edges, 11 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["Hooks.ts"]
  n1["Instance.ts"]
  n2["Lexer.ts"]
  n3["MarkedOptions.ts"]
  n4["Parser.ts"]
  n5["Renderer.ts"]
  n6["TextRenderer.ts"]
  n7["Tokenizer.ts"]
  n8["Tokens.ts"]
  n9["defaults.ts"]
  n10["helpers.ts"]
  n11["marked.ts"]
  n12["rules.ts"]
  n0 --> n9
  n0 --> n2
  n0 --> n4
  n0 --> n3
  n0 --> n8
  n1 --> n9
  n1 --> n2
  n1 --> n4
  n1 --> n0
  n1 --> n5
  n1 --> n7
  n1 --> n6
  n1 --> n10
  n1 --> n3
  n1 --> n8
  n2 --> n7
  n2 --> n9
  n2 --> n12
  n2 --> n8
  n2 --> n3
  n3 --> n8
  n3 --> n4
  n3 --> n2
  n3 --> n5
  n3 --> n7
  n3 --> n0
  n4 --> n5
  n4 --> n6
  n4 --> n9
  n4 --> n8
  n4 --> n3
  n5 --> n9
  n5 --> n10
  n5 --> n12
  n5 --> n3
  n5 --> n8
  n5 --> n4
  n6 --> n8
  n7 --> n9
  n7 --> n10
  n7 --> n12
  n7 --> n2
  n7 --> n8
  n7 --> n3
  n9 --> n3
  n10 --> n12
  n11 --> n2
  n11 --> n4
  n11 --> n7
  n11 --> n5
  n11 --> n6
  n11 --> n0
  n11 --> n1
  n11 --> n9
  n11 --> n3
  n11 --> n8
  n11 --> n1
  n11 --> n9
  n11 --> n2
  n11 --> n4
  n11 --> n7
  n11 --> n5
  n11 --> n6
  n11 --> n0
  n11 --> n1
  n11 --> n3
  n11 --> n8
  %% cycle: defaults.ts -> MarkedOptions.ts -> Parser.ts -> Renderer.ts -> defaults.ts
  %% cycle: MarkedOptions.ts -> Parser.ts -> Renderer.ts -> MarkedOptions.ts
  %% cycle: Parser.ts -> Renderer.ts -> Parser.ts
  %% cycle: defaults.ts -> MarkedOptions.ts -> Parser.ts -> defaults.ts
  %% cycle: MarkedOptions.ts -> Parser.ts -> MarkedOptions.ts
  %% cycle: defaults.ts -> MarkedOptions.ts -> Lexer.ts -> Tokenizer.ts -> defaults.ts
  %% cycle: Lexer.ts -> Tokenizer.ts -> Lexer.ts
  %% cycle: MarkedOptions.ts -> Lexer.ts -> Tokenizer.ts -> MarkedOptions.ts
  %% cycle: defaults.ts -> MarkedOptions.ts -> Lexer.ts -> defaults.ts
  %% cycle: MarkedOptions.ts -> Lexer.ts -> MarkedOptions.ts
  %% cycle: Hooks.ts -> defaults.ts -> MarkedOptions.ts -> Hooks.ts
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

