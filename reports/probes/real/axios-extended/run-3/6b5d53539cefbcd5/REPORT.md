# CodeProof report

Commit: b2c8f4c90801b6c2260a43ce7550c22868a0fb82  |  run-id: 6b5d53539cefbcd5  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 74 / 9564 |
| Import edges / cycles | 177 / 0 |
| Files in scanner prompt | 74 / 74 |
| Findings proposed | 9 |
| Rejected at L1 (bad citation) | 2 |
| Verified | 7 |
| Reproduced by execution (L3) | 4 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 15 / 0 |
| Tokens in / out | 159928 / 28257 |
| Cached input tokens | 5208 |
| Cost | $0.8476 |

## Verified findings

### F-001 - critical - CancelToken cancel guard inverted

**Claim:** CancelToken executor guard is inverted: first cancel() returns early and never sets token.reason, so cancellation never happens.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed + **execution-proven (generated test fails on the analyzed commit)**

**Execution check:** reproduced by execution (see Reproduced by execution)

**Citation (from commit, lines 54-62):** cancel/CancelToken.js
```text
    executor(function cancel(message, config, request) {
      if (!token.reason) {
        // Cancellation has already been requested
        return;
      }

      token.reason = new CanceledError(message, config, request);
      resolvePromise(token.reason);
    });
```

**Verifier (muse-wonder-1.0):** confirm - The guard at cancel/CancelToken.js:55 returns when token.reason is falsy, which is its initial state, so the assignment at cancel/CancelToken.js:60 and resolvePromise at cancel/CancelToken.js:61 are unreachable on the first and every subsequent cancel() call.

### F-003 - critical - spread does not spread array

**Claim:** spread passes the whole array as a single argument instead of spreading it into callback arguments.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed + **execution-proven (generated test fails on the analyzed commit)**

**Execution check:** reproduced by execution (see Reproduced by execution)

**Citation (from commit, lines 24-28):** helpers/spread.js
```text
export default function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, [arr]);
  };
}
```

**Verifier (muse-wonder-1.0):** confirm - The code at helpers/spread.js:26 uses callback.apply(null, [arr]), wrapping arr in another array so the callback receives the whole array as a single argument instead of its elements as separate arguments.

### F-004 - high - isAxiosError matches any object

**Claim:** isAxiosError returns true for any object because missing isAxiosError (undefined !== false) passes the check.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** inconclusive: reproducer failed L0: forbidden console output (it could mask the real failure class)

**Citation (from commit, lines 12-14):** helpers/isAxiosError.js
```text
export default function isAxiosError(payload) {
  return utils.isObject(payload) && payload.isAxiosError !== false;
}
```

**Verifier (muse-wonder-1.0):** confirm - At helpers/isAxiosError.js:13 the only checks are utils.isObject(payload) and payload.isAxiosError !== false, so an ordinary object without the property yields undefined !== false and returns true.

### F-005 - high - combineURLs missing slash separator

**Claim:** combineURLs strips trailing slashes from baseURL and leading slashes from relativeURL then concatenates without adding a separator slash.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed + **execution-proven (generated test fails on the analyzed commit)**

**Execution check:** reproduced by execution (see Reproduced by execution)

**Citation (from commit, lines 11-23):** helpers/combineURLs.js
```text
export default function combineURLs(baseURL, relativeURL) {
  if (!relativeURL) {
    return baseURL;
  }

  let end = baseURL.length;

  while (end > 0 && baseURL.charCodeAt(end - 1) === 47) {
    end--;
  }

  return baseURL.slice(0, end) + relativeURL.replace(/^\/+/, '');
}
```

**Verifier (muse-wonder-1.0):** confirm - The code at helpers/combineURLs.js:22 returns baseURL.slice(0, end) + relativeURL.replace(/^\/+/, '') after stripping trailing slashes at helpers/combineURLs.js:18-20, with no '/' separator inserted between the parts.

### F-006 - high - buildURL appends query after hash

**Claim:** buildURL keeps the '#' when stripping the fragment, so serialized params are appended after '#' instead of before it.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** unavailable: the repository's own imports are not directly executable by Node without a build step (extensionless specifiers or missing packages)

**Citation (from commit, lines 59-66):** helpers/buildURL.js
```text
  if (serializedParams) {
    const hashmarkIndex = url.indexOf('#');

    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex + 1);
    }
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }
```

**Verifier (muse-wonder-1.0):** confirm - The code at helpers/buildURL.js:63 slices to hashmarkIndex + 1, retaining the '#', and helpers/buildURL.js:65 then appends the serialized params after it, placing them in the fragment.

### F-008 - medium - throttle trailing call uses stale args

**Claim:** throttle trailing timeout invokes the stale args captured when the timer was created instead of the latest lastArgs.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** inconclusive: reproducer failed L0: forbidden long timeout

**Citation (from commit, lines 23-37):** helpers/throttle.js
```text
  const throttled = (...args) => {
    const now = Date.now();
    const passed = now - timestamp;
    if (passed >= threshold) {
      invoke(args, now);
    } else {
      lastArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          invoke(args);
        }, threshold - passed);
      }
    }
  };
```

**Verifier (muse-wonder-1.0):** confirm - The timer closure at helpers/throttle.js:31-33 invokes the args captured at timer creation, while later calls only update lastArgs at helpers/throttle.js:29 without updating that closure, so the trailing call uses stale args.

### F-009 - medium - AxiosHeaders.accessor resets internals

**Claim:** AxiosHeaders.accessor unconditionally overwrites this[$internals] with a fresh accessors map, discarding previously registered accessors state.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed + **execution-proven (generated test fails on the analyzed commit)**

**Execution check:** reproduced by execution (see Reproduced by execution)

**Citation (from commit, lines 439-445):** core/AxiosHeaders.js
```text
  static accessor(header) {
    const internals =
      (this[$internals] =
      this[$internals] =
        {
          accessors: {},
        });
```

**Verifier (muse-wonder-1.0):** confirm - The code at core/AxiosHeaders.js:439-445 unconditionally assigns this[$internals] to a newly created object containing accessors: {} with no existing-value guard, discarding the previous accessors map.

## Reproduced by execution

For each finding below, the verifier model wrote a standalone test. The test runs on a `git archive` snapshot of the analyzed commit inside a permission-model sandbox: no network, no writes, 2 s timeout, three runs. The finding is execution-proven only if the test fails 3/3 with an assertion error.

### F-001 - CancelToken cancel guard inverted

**Expected behavior:** First cancel() sets token.reason to a CanceledError with the given message, throwIfRequested() throws that reason, token.promise resolves with it, subscribers are notified, and a second cancel() does not overwrite the first reason.

**Generated test (fails on the analyzed commit):**
```js
import assert from 'node:assert/strict';
import CancelToken from './cancel/CancelToken.js';

const { token, cancel } = CancelToken.source();
assert.equal(token.reason, undefined);
cancel('Operation canceled by test');
assert.ok(token.reason, 'first cancel() should set token.reason');
assert.equal(token.reason.message, 'Operation canceled by test');

let thrown = null;
try {
  token.throwIfRequested();
} catch (err) {
  thrown = err;
}
assert.equal(thrown, token.reason);

let notified = null;
token.subscribe((reason) => { notified = reason; });
assert.equal(notified, token.reason);

cancel('second cancel should be ignored');
assert.equal(token.reason.message, 'Operation canceled by test');

const resolved = await token.promise;
assert.equal(resolved, token.reason);

const source2 = CancelToken.source();
let notified2 = null;
source2.token.subscribe((reason) => { notified2 = reason; });
source2.cancel('second token canceled');
assert.ok(source2.token.reason, 'first cancel() on second token should set reason');
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(notified2, source2.token.reason);
```

**Runner output (last of 3 attempts):**
```text

AssertionError [ERR_ASSERTION]: first cancel() should set token.reason
    at file:///tmp/codeproof-repro-x2E8j8/snapshot/.codeproof-repro.test.mjs:7:8
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: undefined,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v26.8.2
```

### F-003 - spread does not spread array

**Expected behavior:** spread(fn)([1,2,3]) invokes fn with 1, 2, 3 as separate arguments (per the documented example), not with the whole array as a single argument.

**Generated test (fails on the analyzed commit):**
```js
import assert from 'node:assert/strict';
import spread from './helpers/spread.js';

// Documented example: spread(function(x, y, z) {})([1, 2, 3])
let argsSeen;
const result = spread(function (x, y, z) {
  argsSeen = [x, y, z];
  return x + y + z;
})([1, 2, 3]);

assert.deepEqual(argsSeen, [1, 2, 3]);
assert.equal(result, 6);
assert.deepEqual(spread((...args) => args)(['a', 'b']), ['a', 'b']);
```

**Runner output (last of 3 attempts):**
```text
  ]

    at file:///tmp/codeproof-repro-ghMJ32/snapshot/.codeproof-repro.test.mjs:11:8
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: [ [ 1, 2, 3 ], undefined, undefined ],
  expected: [ 1, 2, 3 ],
  operator: 'deepStrictEqual',
  diff: 'simple'
}

Node.js v26.8.2
```

### F-005 - combineURLs missing slash separator

**Expected behavior:** combineURLs('https://example.com/api', '/users') returns 'https://example.com/api/users' with exactly one slash separator regardless of trailing/leading slashes

**Generated test (fails on the analyzed commit):**
```js
import assert from 'node:assert/strict';
import combineURLs from './helpers/combineURLs.js';

assert.equal(combineURLs('https://example.com/api', '/users'), 'https://example.com/api/users');
assert.equal(combineURLs('https://example.com/api/', '/users'), 'https://example.com/api/users');
assert.equal(combineURLs('https://example.com/api', 'users'), 'https://example.com/api/users');
assert.equal(combineURLs('https://example.com/api/', 'users'), 'https://example.com/api/users');
assert.equal(combineURLs('https://example.com/api///', '///users'), 'https://example.com/api/users');
assert.equal(combineURLs('https://example.com/api', ''), 'https://example.com/api');
```

**Runner output (last of 3 attempts):**
```text
                          ^

    at file:///tmp/codeproof-repro-Naqb1d/snapshot/.codeproof-repro.test.mjs:4:8
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 'https://example.com/apiusers',
  expected: 'https://example.com/api/users',
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.8.2
```

### F-009 - AxiosHeaders.accessor resets internals

**Expected behavior:** Re-registering an already-registered header accessor is a no-op: the internals accessors map is preserved across accessor() calls, so previously defined prototype accessor functions are not redefined.

**Generated test (fails on the analyzed commit):**
```js
import assert from 'node:assert/strict';
import AxiosHeaders from './core/AxiosHeaders.js';

AxiosHeaders.accessor('X-Repro');
const firstGet = AxiosHeaders.prototype.getXRepro;
const firstSet = AxiosHeaders.prototype.setXRepro;
assert.equal(typeof firstGet, 'function');
assert.equal(typeof firstSet, 'function');

const headers = new AxiosHeaders();
headers.setXRepro('alpha');
assert.equal(headers.getXRepro(), 'alpha');
assert.equal(headers.get('X-Repro'), 'alpha');

AxiosHeaders.accessor('X-Other');
AxiosHeaders.accessor('X-Repro');

assert.equal(AxiosHeaders.prototype.getXRepro, firstGet);
assert.equal(AxiosHeaders.prototype.setXRepro, firstSet);
assert.equal(headers.getXRepro(), 'alpha');
```

**Runner output (last of 3 attempts):**
```text
- [Function: value]

    at file:///tmp/codeproof-repro-oucAYF/snapshot/.codeproof-repro.test.mjs:18:8
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: [Function: value],
  expected: [Function: value],
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v26.8.2
```

## Architecture

Deterministic facts only: 74 files, 9564 LOC, 177 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["adapters/adapters.js"]
  n1["adapters/fetch.js"]
  n2["adapters/http.js"]
  n3["adapters/xhr.js"]
  n4["axios.js"]
  n5["cancel/CancelToken.js"]
  n6["cancel/CanceledError.js"]
  n7["cancel/isCancel.js"]
  n8["core/Axios.js"]
  n9["core/AxiosError.js"]
  n10["core/AxiosHeaders.js"]
  n11["core/InterceptorManager.js"]
  n12["core/assertParamsAcyclic.js"]
  n13["core/buildFullPath.js"]
  n14["core/createMultipartBody.js"]
  n15["core/dispatchRequest.js"]
  n16["core/mergeConfig.js"]
  n17["core/methodList.js"]
  n18["core/setFormDataHeaders.js"]
  n19["core/settle.js"]
  n20["core/transformData.js"]
  n21["defaults/index.js"]
  n22["defaults/transitional.js"]
  n23["env/classes/FormData.js"]
  n24["env/data.js"]
  n25["helpers/AxiosTransformStream.js"]
  n26["helpers/AxiosURLSearchParams.js"]
  n27["helpers/Http2Sessions.js"]
  n28["helpers/HttpStatusCode.js"]
  n29["helpers/ZlibHeaderTransformStream.js"]
  n30["helpers/bind.js"]
  n31["helpers/buildURL.js"]
  n32["helpers/callbackify.js"]
  n33["helpers/combineURLs.js"]
  n34["helpers/composeSignals.js"]
  n35["helpers/cookies.js"]
  n36["helpers/deprecatedMethod.js"]
  n37["helpers/estimateDataURLDecodedBytes.js"]
  n38["helpers/formDataToBlob.js"]
  n39["helpers/formDataToJSON.js"]
  n40["helpers/formDataToStream.js"]
  n41["helpers/fromDataURI.js"]
  n42["helpers/isAbsoluteURL.js"]
  n43["helpers/isAxiosError.js"]
  n44["helpers/isURLSameOrigin.js"]
  n45["helpers/normalizeURLForProtocolCheck.js"]
  n46["helpers/null.js"]
  n47["helpers/parseHeaders.js"]
  n48["helpers/parseProtocol.js"]
  n49["helpers/progressEventReducer.js"]
  n50["helpers/readBlob.js"]
  n51["helpers/resolveConfig.js"]
  n52["helpers/sanitizeHeaderValue.js"]
  n53["helpers/scheduler.js"]
  n54["helpers/session.js"]
  n55["helpers/shouldBypassProxy.js"]
  n56["helpers/speedometer.js"]
  n57["helpers/spread.js"]
  n58["helpers/throttle.js"]
  n59["helpers/toFormData.js"]
  n60["helpers/toURLEncodedForm.js"]
  n61["helpers/trackStream.js"]
  n62["helpers/validator.js"]
  n63["platform/browser/classes/Blob.js"]
  n64["platform/browser/classes/FormData.js"]
  n65["platform/browser/classes/URLSearchParams.js"]
  n66["platform/browser/index.js"]
  n67["platform/common/utils.js"]
  n68["platform/index.js"]
  n69["platform/node/classes/Buffer.js"]
  n70["platform/node/classes/FormData.js"]
  n71["platform/node/classes/URLSearchParams.js"]
  n72["platform/node/index.js"]
  n73["utils.js"]
  n0 --> n73
  n0 --> n2
  n0 --> n3
  n0 --> n1
  n0 --> n9
  n1 --> n68
  n1 --> n73
  n1 --> n9
  n1 --> n34
  n1 --> n61
  n1 --> n14
  n1 --> n10
  n1 --> n49
  n1 --> n51
  n1 --> n19
  n1 --> n37
  n1 --> n24
  n1 --> n52
  n2 --> n73
  n2 --> n19
  n2 --> n13
  n2 --> n31
  n2 --> n24
  n2 --> n22
  n2 --> n9
  n2 --> n6
  n2 --> n68
  n2 --> n41
  n2 --> n10
  n2 --> n18
  n2 --> n25
  n2 --> n40
  n2 --> n50
  n2 --> n29
  n2 --> n27
  n2 --> n32
  n2 --> n55
  n2 --> n30
  n2 --> n52
  n2 --> n49
  n2 --> n37
  n3 --> n73
  n3 --> n19
  n3 --> n22
  n3 --> n9
  n3 --> n6
  n3 --> n45
  n3 --> n48
  n3 --> n68
  n3 --> n10
  n3 --> n35
  n3 --> n49
  n3 --> n51
  n3 --> n52
  n4 --> n73
  n4 --> n30
  n4 --> n8
  n4 --> n16
  n4 --> n21
  n4 --> n39
  n4 --> n6
  n4 --> n5
  n4 --> n7
  n4 --> n24
  n4 --> n59
  n4 --> n9
  n4 --> n57
  n4 --> n43
  n4 --> n10
  n4 --> n0
  n4 --> n28
  n5 --> n6
  n6 --> n9
  n8 --> n73
  n8 --> n31
  n8 --> n11
  n8 --> n15
  n8 --> n16
  n8 --> n13
  n8 --> n17
  n8 --> n62
  n8 --> n10
  n8 --> n22
  n8 --> n9
  n9 --> n73
  n9 --> n10
  n10 --> n73
  n10 --> n47
  n10 --> n52
  n11 --> n73
  n12 --> n73
  n12 --> n9
  n13 --> n9
  n13 --> n42
  n13 --> n33
  n13 --> n45
  n14 --> n73
  n14 --> n68
  n14 --> n9
  n14 --> n38
  n15 --> n20
  n15 --> n7
  n15 --> n21
  n15 --> n6
  n15 --> n10
  n15 --> n0
  n15 --> n73
  n16 --> n73
  n16 --> n10
  n16 --> n12
  n19 --> n9
  n20 --> n73
  n20 --> n21
  n20 --> n10
  n21 --> n73
  n21 --> n9
  n21 --> n22
  n21 --> n59
  n21 --> n60
  n21 --> n68
  n21 --> n39
  n21 --> n17
  n25 --> n73
  n26 --> n59
  n31 --> n73
  n31 --> n26
  n32 --> n73
  n34 --> n6
  n34 --> n9
  n34 --> n73
  n35 --> n73
  n35 --> n68
  n38 --> n73
  n39 --> n73
  n39 --> n9
  n39 --> n59
  n40 --> n73
  n40 --> n50
  n40 --> n68
  n41 --> n9
  n41 --> n48
  n41 --> n68
  n43 --> n73
  n44 --> n68
  n47 --> n73
  n49 --> n56
  n49 --> n58
  n49 --> n73
  n51 --> n68
  n51 --> n73
  n51 --> n9
  n51 --> n44
  n51 --> n35
  n51 --> n13
  n51 --> n16
  n51 --> n10
  n51 --> n18
  n51 --> n31
  n52 --> n73
  n59 --> n73
  n59 --> n9
  n59 --> n70
  n59 --> n69
  n60 --> n73
  n60 --> n59
  n60 --> n68
  n62 --> n24
  n62 --> n9
  n65 --> n26
  n66 --> n65
  n66 --> n64
  n66 --> n63
  n68 --> n72
  n68 --> n67
  n72 --> n71
  n72 --> n70
  n73 --> n30
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

