# CodeProof report

Commit: e3349b542eaaf55239cb60519991b80097cee24b  |  run-id: b0941ba03c256e66  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 1 / 337 |
| Import edges / cycles | 0 / 0 |
| Files in scanner prompt | 1 / 1 |
| Findings proposed | 1 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 1 |
| Reproduced by execution (L3) | 1 |
| Patch-proven (L4, differential) | 1 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 4 / 0 |
| Tokens in / out | 11382 / 20608 |
| Cached input tokens | 1116 |
| Cost | $0.2101 |

## Verified findings

### F-001 - high - Negative numbers with hexadecimal/binary/octal produce invalid literals

**Claim:** For negative numbers argument.toString(16/2/8) returns a string with a leading '-', so prefixing with '0x'/'0b'/'0o' yields '0x-A' / '0b-...' / '0o-...' instead of '-0xA' / '-0b...' / '-0o...', which is not valid JavaScript.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed + **execution-proven (generated test fails on the analyzed commit)**

**Execution check:** reproduced by execution: the control passed 3/3 and the trigger failed 3/3 (see Reproduced by execution)

**Citation (from commit, lines 216-221):** jsesc.js
```text
			} else if (useHexNumbers) {
				let hexadecimal = argument.toString(16);
				if (!lowercaseHex) {
					hexadecimal = hexadecimal.toUpperCase();
				}
				result = '0x' + hexadecimal;
```
**Citation (from commit, lines 222-225):** jsesc.js
```text
			} else if (useBinNumbers) {
				result = '0b' + argument.toString(2);
			} else if (useOctNumbers) {
				result = '0o' + argument.toString(8);
```

**Verifier (muse-wonder-1.0):** confirm - The number branch at jsesc.js:216-225 unconditionally prefixes argument.toString(16/2/8) with '0x'/'0b'/'0o' with no sign handling, so a negative value such as -10 yields '0x-A'/'0b-1010'/'0o-12', which is invalid JavaScript.

## Reproduced by execution

For each finding below, the verifier model wrote two standalone files. They run on a `git archive` snapshot of the analyzed commit inside a permission-model sandbox: no network, no writes, 2 s timeout, three runs each.

- **[CONTROL]** uses a clean, normal input and must pass 3/3. It proves the environment and the way the API is called are valid; if it fails, the finding is reported as `control-failed` and the trigger is never run.
- **[TRIGGER]** uses a different input and must fail 3/3 with an assertion error on the analyzed commit.
- **LinkCheck** (Node 26) runs the trigger under the permission model with inspector coverage and requires that the imported symbol actually executed. Without that linkage proof the finding is not reported as execution-proven.


### F-001 - Negative numbers with hexadecimal/binary/octal produce invalid literals

**Expected behavior:** Negative numbers formatted as hexadecimal/binary/octal should place the minus sign before the prefix, e.g. -0xA, -0b101, -0o10, producing valid JavaScript literals.

**Control (must pass 3/3 on the analyzed commit):**
```js
import assert from 'node:assert/strict';
import jsesc from './jsesc.js';
const hex = jsesc(255, { numbers: 'hexadecimal' });
assert.equal(hex, '0xFF');
const bin = jsesc(6, { numbers: 'binary' });
assert.equal(bin, '0b110');
const oct = jsesc(9, { numbers: 'octal' });
assert.equal(oct, '0o11');
```

**Trigger (must fail 3/3 with an assertion error on the analyzed commit):**
```js
import assert from 'node:assert/strict';
import jsesc from './jsesc.js';
const hex = jsesc(-10, { numbers: 'hexadecimal' });
assert.equal(hex, '-0xA');
const bin = jsesc(-5, { numbers: 'binary' });
assert.equal(bin, '-0b101');
const oct = jsesc(-8, { numbers: 'octal' });
assert.equal(oct, '-0o10');
```

**LinkCheck:** proven - the imported symbol executed under inspector coverage.

**Runner output (last of 3 attempts):**
```text
'0x-A' !== '-0xA'

    at file:///tmp/codeproof-repro-RrRHgl/snapshot/.codeproof-repro.test.mjs:4:8
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: '0x-A',
  expected: '-0xA',
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.8.2
```

## Patch-proven (differential proof)

For each finding below the patcher model proposed a minimal patch to one of the cited files. The patch is applied to a **copy** of the L3 snapshot (the snapshot itself is never mutated) and both phases are re-run: the control must still pass 3/3 and the trigger must now pass 3/3. This is a differential result over the reproduction - it does not claim to fix the root cause, and the repository's own test suite is not run.

### F-001 - Negative numbers with hexadecimal/binary/octal produce invalid literals

**Patch rationale:** Negative numbers stringify with a leading '-', so prefixing '0x'/'0b'/'0o' produced invalid '0x-A' etc. Use Math.abs for digits and emit sign before prefix.

```diff
--- a/jsesc.js
+++ b/jsesc.js
@@ -217,9 +217,9 @@
-				let hexadecimal = argument.toString(16);
-				if (!lowercaseHex) {
-					hexadecimal = hexadecimal.toUpperCase();
-				}
-				result = '0x' + hexadecimal;
-			} else if (useBinNumbers) {
-				result = '0b' + argument.toString(2);
-			} else if (useOctNumbers) {
-				result = '0o' + argument.toString(8);
+				let hexadecimal = Math.abs(argument).toString(16);
+				if (!lowercaseHex) {
+					hexadecimal = hexadecimal.toUpperCase();
+				}
+				result = (argument < 0 ? '-0x' : '0x') + hexadecimal;
+			} else if (useBinNumbers) {
+				result = (argument < 0 ? '-0b' : '0b') + Math.abs(argument).toString(2);
+			} else if (useOctNumbers) {
+				result = (argument < 0 ? '-0o' : '0o') + Math.abs(argument).toString(8);
```

**Differential result:** control passed 3/3, trigger passed 3/3 after the patch. The repository's own test suite was not run; the patch was never written to the analyzed repository.

**Warnings:** replaceBlock contains literals that also appear in the generated test (possible overfitting): 0, 0, 0

## Architecture

Deterministic facts only: 1 files, 337 LOC, 0 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["jsesc.js"]
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

