# CodeProof report

Commit: 1211e9a2213e0b3ee232a204b3ce899beebce31a  |  run-id: 56f8831fa1284062  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 11 / 1666 |
| Import edges / cycles | 3 / 0 |
| Files in scanner prompt | 11 / 11 |
| Findings proposed | 1 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 1 |
| Reproduced by execution (L3) | 1 |
| Patch-proven (L4, differential) | 1 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 4 / 0 |
| Tokens in / out | 62904 / 18318 |
| Cached input tokens | 0 |
| Cost | $0.3876 |

## Verified findings

### F-001 - medium - base64_decode missing invalid-character check for c4

**Claim:** c4 is ORed into the output byte without checking for -1, producing String.fromCharCode(0xFFFFFFFF)=65535 instead of breaking like c1/c2/c3 do.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed + **execution-proven (generated test fails on the analyzed commit)**

**Execution check:** reproduced by execution: the control passed 3/3 and the trigger failed 3/3 (see Reproduced by execution)

**Citation (from commit, lines 484-496):** index.js
```text
    code = s.charCodeAt(off++);
    c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c3 == -1) break;
    o = ((c2 & 0x0f) << 4) >>> 0;
    o |= (c3 & 0x3c) >> 2;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    o = ((c3 & 0x03) << 6) >>> 0;
    o |= c4;
    rs.push(String.fromCharCode(o));
    ++olen;
```

**Verifier (muse-wonder-1.0):** confirm - Confirmed at index.js:492-495: c4 gets the -1 fallback and is ORed into o and pushed via String.fromCharCode(o) with no c4==-1 break, unlike c3 at index.js:486, so o becomes -1 and fromCharCode yields 65535.

## Reproduced by execution

For each finding below, the verifier model wrote two standalone files. They run on a `git archive` snapshot of the analyzed commit inside a permission-model sandbox: no network, no writes, 2 s timeout, at least three runs each.

- **[CONTROL]** uses a clean, normal input and must pass every run. It proves the environment and the way the API is called are valid; if it fails, the finding is reported as `control-failed` and the trigger is never run.
- **[TRIGGER]** uses a different input and must fail every run with an assertion error on the analyzed commit.
- **LinkCheck** (Node 26) runs the trigger under the permission model with inspector coverage and requires that the imported symbol actually executed. Without that linkage proof the finding is not reported as execution-proven.


### F-001 - base64_decode missing invalid-character check for c4

**Expected behavior:** decodeBase64 stops decoding at an invalid character, as it does for c3, returning only bytes decoded before that character.

**Control (must pass 3/3 on the analyzed commit):**
```js
import assert from "node:assert/strict";
import { decodeBase64 } from "./index.js";
const result = decodeBase64("AA!A", 3);
assert.deepEqual(result, [8]);
assert.equal(result.length, 1);
```

**Trigger (must fail 3/3 with an assertion error on the analyzed commit):**
```js
import assert from "node:assert/strict";
import { decodeBase64 } from "./index.js";
const result = decodeBase64("AAA!", 3);
assert.deepEqual(result, [8, 32]);
assert.equal(result.length, 2);
```

**LinkCheck:** proven (symbol) - the imported symbol executed under inspector coverage.

**Runner output (last of 3 attempts):**
```text
  ]

    at file:///tmp/codeproof-repro-Tg2rUz/snapshot/.codeproof-repro.test.mjs:4:8
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: [ 8, 32, 65535 ],
  expected: [ 8, 32 ],
  operator: 'deepStrictEqual',
  diff: 'simple'
}

Node.js v26.8.2
```

## Patch-proven (differential proof)

For each finding below the patcher model proposed a minimal patch to one of the cited files. The patch is applied to a **copy** of the L3 snapshot (the snapshot itself is never mutated) and both phases are re-run: the control must still pass every run and the trigger must now pass every run. This is a differential result over the reproduction - it does not claim to fix the root cause, and the repository's own test suite is not run.

### F-001 - base64_decode missing invalid-character check for c4

**Patch rationale:** Add the missing c4 == -1 break in base64_decode, mirroring c1/c2/c3, so an invalid fourth character stops decoding instead of OR-ing -1 into a bogus 0xFFFF byte.

```diff
--- a/index.js
+++ b/index.js
@@ -492,0 +493,1 @@
+    if (c4 == -1) break;
```

**Differential result:** control passed 3/3, trigger passed 3/3 after the patch. The repository's own test suite was not run; the patch was never written to the analyzed repository.

**Warnings:** replaceBlock contains literals that also appear in the generated test (possible overfitting): 6

## Architecture

Deterministic facts only: 11 files, 1666 LOC, 3 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0[".prettierrc.js"]
  n1["index.d.ts"]
  n2["index.js"]
  n3["scripts/build.js"]
  n4["tests/bench.js"]
  n5["tests/index.js"]
  n6["tests/typescript/test-global.ts"]
  n7["tests/typescript/test-import.ts"]
  n8["tests/typescript/test-require.ts"]
  n9["types.d.ts"]
  n10["umd/index.d.ts"]
  n4 --> n2
  n5 --> n2
  n7 --> n2
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

