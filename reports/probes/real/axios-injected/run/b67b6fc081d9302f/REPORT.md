# CodeProof report

Commit: 776d018340e310ab877a1ee9dada071b4f480b71  |  run-id: b67b6fc081d9302f  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if the deterministic citation gate (L1) passed and the adversarial verifier confirmed it. Refuted, uncertain and moderate findings are kept in separate sections - nothing is hidden, and nothing unproven is presented as verified.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 74 / 9564 |
| Import edges / cycles | 177 / 0 |
| Findings proposed | 4 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 4 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 5 / 0 |
| Tokens in / out | 123990 / 10858 |
| Cached input tokens | 1000 |
| Cost | $0.3448 |

## Verified findings

### F-001 - critical - combineURLs omits '/' separator

**Claim:** combineURLs strips trailing slashes from baseURL and leading slashes from relativeURL then concatenates without inserting a separator, producing e.g. base+relative without '/'

**Citation:** helpers/combineURLs.js:11-23
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

**Verifier (muse-wonder-1.0):** confirm - The code at helpers/combineURLs.js:22 returns baseURL.slice(0, end) + relativeURL.replace(/^\/+/, '') with no '/' inserted after trimming trailing slashes at helpers/combineURLs.js:18-20 and leading slashes, so e.g. 'https://x/api/' + '/users' becomes 'https://x/apiusers', and core/buildFullPath.js:73 passes the result through directly.

### F-002 - high - buildURL appends query after fragment

**Claim:** buildURL keeps the '#' when stripping the fragment before appending serialized params, so query string is appended after '#' and becomes part of the fragment instead of the query

**Citation:** helpers/buildURL.js:59-66
```text
  if (serializedParams) {
    const hashmarkIndex = url.indexOf('#');

    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex + 1);
    }
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }
```

**Verifier (muse-wonder-1.0):** confirm - At helpers/buildURL.js:63 url.slice(0, hashmarkIndex + 1) retains the '#' character, and helpers/buildURL.js:65 then appends '?/&' plus serializedParams after it, so the params fall inside the fragment rather than the query string.

### F-003 - high - ArrayBufferView loses offset/length

**Claim:** transformRequest returns data.buffer for any ArrayBuffer view, discarding byteOffset and byteLength so a subarray/view sends the whole underlying buffer

**Citation:** defaults/index.js:70-72
```text
      if (utils.isArrayBufferView(data)) {
        return data.buffer;
      }
```

**Verifier (muse-wonder-1.0):** confirm - The branch at defaults/index.js:70-72 unconditionally returns data.buffer for isArrayBufferView data without applying byteOffset or byteLength, so a subarray or offset view is expanded to its entire underlying buffer.

### F-004 - medium - Scheduler start replaces timer without clear

**Claim:** createScheduler.start overwrites this.timer with a new setInterval without clearing an existing interval, leaking the previous timer

**Citation:** helpers/scheduler.js:3-13
```text
export function createScheduler() {
  return {
    timer: null,
    start(callback, intervalMs) {
      this.timer = setInterval(callback, intervalMs);
    },
    stop() {
      clearInterval(this.timer);
      this.timer = null;
    }
```

**Verifier (muse-wonder-1.0):** confirm - The code at helpers/scheduler.js:6-7 assigns this.timer = setInterval(callback, intervalMs) with no prior clearInterval or guard, while helpers/scheduler.js:9-11 stop() can only clear the most recent timer, so a second start() loses the previous interval reference and leaks it.

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

- Static analysis only: the analyzed code is never executed.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

