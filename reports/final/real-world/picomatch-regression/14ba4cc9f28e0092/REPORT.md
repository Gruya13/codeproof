# CodeProof report

Commit: 6bb40679c218cefba5d4e9662408c5fdf699a8bb  |  run-id: 14ba4cc9f28e0092  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 5 / 2445 |
| Import edges / cycles | 9 / 0 |
| Files in scanner prompt | 5 / 5 |
| Findings proposed | 1 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 1 |
| Reproduced by execution (L3) | 1 |
| Patch-proven (L4, differential) | 1 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 6 / 0 |
| Tokens in / out | 74570 / 41542 |
| Cached input tokens | 23281 |
| Cost | $0.5465 |

## Verified findings

### F-001 - medium - Falsy prevIndex check drops leading-slash trailing token

**Claim:** Last path segment token is never assigned when the final slash is at index 0 because prevIndex is tested for truthiness instead of definedness, so scan('/a',{tokens:true}) leaves the trailing token empty and maxDepth under-counted.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed + **execution-proven (generated test fails on the analyzed commit)**

**Execution check:** reproduced by execution: the control passed 3/3 and the trigger failed 3/3 (see Reproduced by execution)

**Citation (from commit, lines 390-394):** scan.js
```text
    if (opts.tokens && prevIndex && prevIndex + 1 < input.length) {
      tokens[tokens.length - 1].value = value;
      depth(tokens[tokens.length - 1]);
      state.maxDepth += tokens[tokens.length - 1].depth;
    }
```

**Verifier (muse-wonder-1.0):** confirm - The loop sets prevIndex to the slash index at scan.js:382, and the final token assignment at scan.js:391-393 is guarded by the truthy check at scan.js:390, so for '/a' with its only slash at index 0 that assignment and maxDepth increment are skipped.

## Reproduced by execution

For each finding below, the verifier model wrote two standalone files. They run on a `git archive` snapshot of the analyzed commit inside a permission-model sandbox: no network, no writes, 2 s timeout, at least three runs each.

- **[CONTROL]** uses a clean, normal input and must pass every run. It proves the environment and the way the API is called are valid; if it fails, the finding is reported as `control-failed` and the trigger is never run.
- **[TRIGGER]** uses a different input and must fail every run with an assertion error on the analyzed commit.
- **LinkCheck** (Node 26) runs the trigger under the permission model with inspector coverage and requires that the imported symbol actually executed. Without that linkage proof the finding is not reported as execution-proven.


### F-001 - Falsy prevIndex check drops leading-slash trailing token

**Expected behavior:** Trailing token after the last slash is assigned its segment value and counted in maxDepth

**Control (must pass 3/3 on the analyzed commit):**
```js
import assert from 'node:assert/strict';
import scan from './scan.js';
const result = scan('a/b', { tokens: true });
assert.equal(result.tokens[result.tokens.length - 1].value, 'b');
assert.equal(result.maxDepth, 2);
```

**Trigger (must fail 3/3 with an assertion error on the analyzed commit):**
```js
import assert from 'node:assert/strict';
import scan from './scan.js';
const result = scan('/a', { tokens: true });
assert.equal(result.tokens[result.tokens.length - 1].value, 'a');
assert.equal(result.maxDepth, 2);
```

**LinkCheck:** proven (symbol) - the imported symbol executed under inspector coverage.

**Runner output (last of 3 attempts):**
```text
'' !== 'a'

    at file:///tmp/codeproof-repro-V4ILjZ/snapshot/.codeproof-repro.test.mjs:4:8
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: '',
  expected: 'a',
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.8.2
```

## Patch-proven (differential proof)

For each finding below the patcher model proposed a minimal patch to one of the cited files. The patch is applied to a **copy** of the L3 snapshot (the snapshot itself is never mutated) and both phases are re-run: the control must still pass every run and the trigger must now pass every run. This is a differential result over the reproduction - it does not claim to fix the root cause, and the repository's own test suite is not run.

### F-001 - Falsy prevIndex check drops leading-slash trailing token

**Patch rationale:** prevIndex=0 for '/a' is falsy, so the trailing token assignment is skipped; testing definedness matches the prevIndex handling already used above.

```diff
--- a/scan.js
+++ b/scan.js
@@ -390,1 +390,1 @@
-    if (opts.tokens && prevIndex && prevIndex + 1 < input.length) {
+    if (opts.tokens && prevIndex !== undefined && prevIndex + 1 < input.length) {
```

**Differential result:** control passed 3/3, trigger passed 3/3 after the patch. The repository's own test suite was not run; the patch was never written to the analyzed repository.

**Warnings:** replaceBlock contains literals that also appear in the generated test (possible overfitting): 1

## Architecture

Deterministic facts only: 5 files, 2445 LOC, 9 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["constants.js"]
  n1["parse.js"]
  n2["picomatch.js"]
  n3["scan.js"]
  n4["utils.js"]
  n1 --> n0
  n1 --> n4
  n2 --> n3
  n2 --> n1
  n2 --> n4
  n2 --> n0
  n3 --> n4
  n3 --> n0
  n4 --> n0
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

