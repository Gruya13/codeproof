# CodeProof report

Commit: 6bb40679c218cefba5d4e9662408c5fdf699a8bb  |  run-id: 62cbababd7a84e9a  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 5 / 2445 |
| Import edges / cycles | 9 / 0 |
| Files in scanner prompt | 5 / 5 |
| Findings proposed | 3 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 2 |
| Reproduced by execution (L3) | 1 |
| Patch-proven (L4, differential) | 1 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 1 |
| Calls / retries | 11 / 0 |
| Tokens in / out | 102002 / 64961 |
| Cached input tokens | 24376 |
| Cost | $1.0269 |

## Verified findings

### F-001 - high - scan with noext clears isGlob

**Claim:** When opts.noext is true scan clears isGlob unconditionally, so patterns like "*.js" are reported as non-globs even though only extglobs should be disabled.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed + **execution-proven (generated test fails on the analyzed commit)**

**Execution check:** reproduced by execution: the control passed 3/3 and the trigger failed 3/3 (see Reproduced by execution)

**Citation (from commit, lines 301-304):** scan.js
```text
  if (opts.noext === true) {
    isExtglob = false;
    isGlob = false;
  }
```

**Verifier (muse-wonder-1.0):** confirm - The cited code at scan.js:301-304 unconditionally sets isGlob=false whenever opts.noext is true, and the returned state at scan.js:340-353 reports that cleared isGlob value, so a non-extglob pattern such as *.js would be reported as a non-glob.

### F-003 - medium - first tokens entry overwritten with prefix

**Claim:** First slash token is marked as prefix whenever start != 0, so for a negated pattern like "!foo/bar" the "foo" segment is overwritten with prefix "!" instead of only treating slashes before start as prefix.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** inconclusive: reproducer failed L0: unsupported response must not include testCode; unsupported response must not include controlCode; unsupportedReason is too short

**Citation (from commit, lines 370-376):** scan.js
```text
      if (opts.tokens) {
        if (idx === 0 && start !== 0) {
          tokens[idx].isPrefix = true;
          tokens[idx].value = prefix;
        } else {
          tokens[idx].value = value;
        }
```

**Verifier (muse-wonder-1.0):** confirm - The code at scan.js:371-373 unconditionally sets tokens[0].isPrefix and tokens[0].value to prefix whenever start is non-zero, without checking whether the first slash at scan.js:368 precedes start as the parts logic does at scan.js:380.

## Reproduced by execution

For each finding below, the verifier model wrote two standalone files. They run on a `git archive` snapshot of the analyzed commit inside a permission-model sandbox: no network, no writes, 2 s timeout, three runs each.

- **[CONTROL]** uses a clean, normal input and must pass 3/3. It proves the environment and the way the API is called are valid; if it fails, the finding is reported as `control-failed` and the trigger is never run.
- **[TRIGGER]** uses a different input and must fail 3/3 with an assertion error on the analyzed commit.
- **LinkCheck** (Node 26) runs the trigger under the permission model with inspector coverage and requires that the imported symbol actually executed. Without that linkage proof the finding is not reported as execution-proven.


### F-001 - scan with noext clears isGlob

**Expected behavior:** scan('*.js', { noext: true }) should still report isGlob:true and glob:'*.js' because noext only disables extglobs, while '*' is a regular glob; isExtglob should remain false.

**Control (must pass 3/3 on the analyzed commit):**
```js
import assert from 'node:assert/strict';
import scan from './scan.js';
const result = scan('*.js');
assert.equal(result.isGlob, true);
assert.equal(result.isExtglob, false);
assert.equal(result.glob, '*.js');
```

**Trigger (must fail 3/3 with an assertion error on the analyzed commit):**
```js
import assert from 'node:assert/strict';
import scan from './scan.js';
const result = scan('*.js', { noext: true });
assert.equal(result.isGlob, true);
assert.equal(result.isExtglob, false);
assert.equal(result.glob, '*.js');
```

**LinkCheck:** proven - the imported symbol executed under inspector coverage.

**Runner output (last of 3 attempts):**
```text
false !== true

    at file:///tmp/codeproof-repro-mnH7Sd/snapshot/.codeproof-repro.test.mjs:4:8
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.8.2
```

## Patch-proven (differential proof)

For each finding below the patcher model proposed a minimal patch to one of the cited files. The patch is applied to a **copy** of the L3 snapshot (the snapshot itself is never mutated) and both phases are re-run: the control must still pass 3/3 and the trigger must now pass 3/3. This is a differential result over the reproduction - it does not claim to fix the root cause, and the repository's own test suite is not run.

### F-001 - scan with noext clears isGlob

**Patch rationale:** Removing the unconditional isGlob=false under noext keeps *.js as a glob while still disabling extglob detection.

```diff
--- a/scan.js
+++ b/scan.js
@@ -303,1 +302,0 @@
-    isGlob = false;
```

**Differential result:** control passed 3/3, trigger passed 3/3 after the patch. The repository's own test suite was not run; the patch was never written to the analyzed repository.

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

