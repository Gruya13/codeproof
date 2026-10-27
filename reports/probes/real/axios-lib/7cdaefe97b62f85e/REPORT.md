# CodeProof report

Commit: 790b5ba1d95a95e93d59b76995595c37f2b90a66  |  run-id: 7cdaefe97b62f85e  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if the deterministic citation gate (L1) passed and the adversarial verifier confirmed it. Refuted, uncertain and moderate findings are kept in separate sections - nothing is hidden, and nothing unproven is presented as verified.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 72 / 9546 |
| Import edges / cycles | 177 / 0 |
| Findings proposed | 0 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 1 / 0 |
| Tokens in / out | 93127 / 8731 |
| Cached input tokens | 0 |
| Cost | $0.1535 |

## Verified findings

_None this run._

## Architecture

Deterministic facts only: 72 files, 9546 LOC, 177 import edges, 0 cycles. The diagram is generated from the import graph by code, never by the model.

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
  n53["helpers/shouldBypassProxy.js"]
  n54["helpers/speedometer.js"]
  n55["helpers/spread.js"]
  n56["helpers/throttle.js"]
  n57["helpers/toFormData.js"]
  n58["helpers/toURLEncodedForm.js"]
  n59["helpers/trackStream.js"]
  n60["helpers/validator.js"]
  n61["platform/browser/classes/Blob.js"]
  n62["platform/browser/classes/FormData.js"]
  n63["platform/browser/classes/URLSearchParams.js"]
  n64["platform/browser/index.js"]
  n65["platform/common/utils.js"]
  n66["platform/index.js"]
  n67["platform/node/classes/Buffer.js"]
  n68["platform/node/classes/FormData.js"]
  n69["platform/node/classes/URLSearchParams.js"]
  n70["platform/node/index.js"]
  n71["utils.js"]
  n0 --> n71
  n0 --> n2
  n0 --> n3
  n0 --> n1
  n0 --> n9
  n1 --> n66
  n1 --> n71
  n1 --> n9
  n1 --> n34
  n1 --> n59
  n1 --> n14
  n1 --> n10
  n1 --> n49
  n1 --> n51
  n1 --> n19
  n1 --> n37
  n1 --> n24
  n1 --> n52
  n2 --> n71
  n2 --> n19
  n2 --> n13
  n2 --> n31
  n2 --> n24
  n2 --> n22
  n2 --> n9
  n2 --> n6
  n2 --> n66
  n2 --> n41
  n2 --> n10
  n2 --> n18
  n2 --> n25
  n2 --> n40
  n2 --> n50
  n2 --> n29
  n2 --> n27
  n2 --> n32
  n2 --> n53
  n2 --> n30
  n2 --> n52
  n2 --> n49
  n2 --> n37
  n3 --> n71
  n3 --> n19
  n3 --> n22
  n3 --> n9
  n3 --> n6
  n3 --> n45
  n3 --> n48
  n3 --> n66
  n3 --> n10
  n3 --> n35
  n3 --> n49
  n3 --> n51
  n3 --> n52
  n4 --> n71
  n4 --> n30
  n4 --> n8
  n4 --> n16
  n4 --> n21
  n4 --> n39
  n4 --> n6
  n4 --> n5
  n4 --> n7
  n4 --> n24
  n4 --> n57
  n4 --> n9
  n4 --> n55
  n4 --> n43
  n4 --> n10
  n4 --> n0
  n4 --> n28
  n5 --> n6
  n6 --> n9
  n8 --> n71
  n8 --> n31
  n8 --> n11
  n8 --> n15
  n8 --> n16
  n8 --> n13
  n8 --> n17
  n8 --> n60
  n8 --> n10
  n8 --> n22
  n8 --> n9
  n9 --> n71
  n9 --> n10
  n10 --> n71
  n10 --> n47
  n10 --> n52
  n11 --> n71
  n12 --> n71
  n12 --> n9
  n13 --> n9
  n13 --> n42
  n13 --> n33
  n13 --> n45
  n14 --> n71
  n14 --> n66
  n14 --> n9
  n14 --> n38
  n15 --> n20
  n15 --> n7
  n15 --> n21
  n15 --> n6
  n15 --> n10
  n15 --> n0
  n15 --> n71
  n16 --> n71
  n16 --> n10
  n16 --> n12
  n19 --> n9
  n20 --> n71
  n20 --> n21
  n20 --> n10
  n21 --> n71
  n21 --> n9
  n21 --> n22
  n21 --> n57
  n21 --> n58
  n21 --> n66
  n21 --> n39
  n21 --> n17
  n25 --> n71
  n26 --> n57
  n31 --> n71
  n31 --> n26
  n32 --> n71
  n34 --> n6
  n34 --> n9
  n34 --> n71
  n35 --> n71
  n35 --> n66
  n38 --> n71
  n39 --> n71
  n39 --> n9
  n39 --> n57
  n40 --> n71
  n40 --> n50
  n40 --> n66
  n41 --> n9
  n41 --> n48
  n41 --> n66
  n43 --> n71
  n44 --> n66
  n47 --> n71
  n49 --> n54
  n49 --> n56
  n49 --> n71
  n51 --> n66
  n51 --> n71
  n51 --> n9
  n51 --> n44
  n51 --> n35
  n51 --> n13
  n51 --> n16
  n51 --> n10
  n51 --> n18
  n51 --> n31
  n52 --> n71
  n57 --> n71
  n57 --> n9
  n57 --> n68
  n57 --> n67
  n58 --> n71
  n58 --> n57
  n58 --> n66
  n60 --> n24
  n60 --> n9
  n63 --> n26
  n64 --> n63
  n64 --> n62
  n64 --> n61
  n66 --> n70
  n66 --> n65
  n70 --> n69
  n70 --> n68
  n71 --> n30
```

## Limits

- Static analysis only: the analyzed code is never executed.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

