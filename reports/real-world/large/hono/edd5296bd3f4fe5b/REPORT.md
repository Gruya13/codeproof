# CodeProof report

Commit: bac5c4a8bcd76b165428ce757e1185753c7935bd  |  run-id: edd5296bd3f4fe5b  |  mode: smoke

**Publishing rule:** a finding appears under *Verified findings* only if every citation passed L1 and the adversarial verifier confirmed it. This checks provenance and model agreement, not semantic proof. Refuted, uncertain and moderate findings are in rejected.md.

## Summary

| Metric | Value |
|---|---|
| Files / LOC | 313 / 82078 |
| Import edges / cycles | 748 / 17 |
| Files in scanner prompt | 69 / 313 (truncated at 400000 chars) |
| Findings proposed | 3 |
| Rejected at L1 (bad citation) | 0 |
| Verified | 3 |
| Reproduced by execution (L3) | 0 |
| Moderate confidence | 0 |
| Refuted | 0 |
| Uncertain | 0 |
| Calls / retries | 7 / 0 |
| Tokens in / out | 173685 / 34655 |
| Cached input tokens | 988 |
| Cost | $0.8660 |

## Verified findings

### F-001 - high - ALB headers joined with wrong delimiter

**Claim:** ALB multi-value headers are joined with '; ' for all headers, corrupting list-based headers like x-forwarded-for which require ', ' joining.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** unavailable: the repository's own imports are not directly executable by Node without a build step (extensionless specifiers)

**Citation (from commit, lines 546-551):** adapter/aws-lambda/handler.ts
```text
    if (event.multiValueHeaders) {
      for (const [key, values] of Object.entries(event.multiValueHeaders)) {
        if (values && Array.isArray(values)) {
          // https://www.rfc-editor.org/rfc/rfc9110.html#name-common-rules-for-defining-f
          const sanitizedValue = sanitizeHeaderValue(values.join('; '))
          headers.set(key, sanitizedValue)
```

**Verifier (muse-wonder-1.0):** confirm - The ALBProcessor.getHeaders at adapter/aws-lambda/handler.ts:546-551 iterates every multiValueHeaders entry and unconditionally joins values with '; ' via values.join('; ') and headers.set, with no per-header delimiter distinction, so list-based headers such as x-forwarded-for are not comma-joined.

### F-002 - high - ALB query string not URL-encoded

**Claim:** ALB query-string builder interpolates raw keys and values without encodeURIComponent, producing invalid URLs for spaces, &, =, and non-ASCII unlike the V1 processor.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** unavailable: the repository's own imports are not directly executable by Node without a build step (extensionless specifiers)

**Citation (from commit, lines 585-595):** adapter/aws-lambda/handler.ts
```text
    if (event.multiValueQueryStringParameters) {
      return Object.entries(event.multiValueQueryStringParameters || {})
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}=${value.join(`&${key}=`)}`)
        .join('&')
    } else {
      return Object.entries(event.queryStringParameters || {})
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`)
        .join('&')
    }
```

**Verifier (muse-wonder-1.0):** confirm - The ALB getQueryString at adapter/aws-lambda/handler.ts:585-595 interpolates raw keys and values via `${key}=${value.join(`&${key}=`)}` and `${key}=${value}` with no encodeURIComponent, so characters such as & and = in values would be parsed as delimiters.

### F-003 - high - Lattice query string always empty

**Claim:** Lattice V2 processor ignores queryStringParameters entirely by returning empty string, dropping query parameters when path does not already contain them.

**Proposed by:** Muse Spark

**Evidence level:** citation-proven + adversarially-confirmed

**Execution check:** unavailable: the repository's own imports are not directly executable by Node without a build step (extensionless specifiers)

**Citation (from commit, lines 634-636):** adapter/aws-lambda/handler.ts
```text
  protected getQueryString(): string {
    return ''
  }
```

**Verifier (muse-wonder-1.0):** confirm - LatticeV2Processor.getPath returns only event.path at adapter/aws-lambda/handler.ts:626-628 and getQueryString takes no event argument and unconditionally returns '' at adapter/aws-lambda/handler.ts:634-636, so queryStringParameters are never incorporated into the request URL.

## Architecture

Deterministic facts only: 313 files, 82078 LOC, 748 import edges, 17 cycles. The diagram is generated from the import graph by code, never by the model.

```mermaid
graph LR
  n0["adapter/aws-lambda/conninfo.test.ts"]
  n1["adapter/aws-lambda/conninfo.ts"]
  n2["adapter/aws-lambda/handler.test.ts"]
  n3["adapter/aws-lambda/handler.ts"]
  n4["adapter/aws-lambda/index.ts"]
  n5["adapter/aws-lambda/types.ts"]
  n6["adapter/bun/conninfo.test.ts"]
  n7["adapter/bun/conninfo.ts"]
  n8["adapter/bun/index.ts"]
  n9["adapter/bun/serve-static.ts"]
  n10["adapter/bun/server.test.ts"]
  n11["adapter/bun/server.ts"]
  n12["adapter/bun/ssg.ts"]
  n13["adapter/bun/websocket.test.ts"]
  n14["adapter/bun/websocket.ts"]
  n15["adapter/cloudflare-pages/conninfo.test.ts"]
  n16["adapter/cloudflare-pages/conninfo.ts"]
  n17["adapter/cloudflare-pages/handler.test.ts"]
  n18["adapter/cloudflare-pages/handler.ts"]
  n19["adapter/cloudflare-pages/index.ts"]
  n20["adapter/cloudflare-workers/conninfo.test.ts"]
  n21["adapter/cloudflare-workers/conninfo.ts"]
  n22["adapter/cloudflare-workers/index.ts"]
  n23["adapter/cloudflare-workers/serve-static-module.ts"]
  n24["adapter/cloudflare-workers/serve-static.test.ts"]
  n25["adapter/cloudflare-workers/serve-static.ts"]
  n26["adapter/cloudflare-workers/utils.test.ts"]
  n27["adapter/cloudflare-workers/utils.ts"]
  n28["adapter/cloudflare-workers/websocket.test.ts"]
  n29["adapter/cloudflare-workers/websocket.ts"]
  n30["adapter/deno/conninfo.test.ts"]
  n31["adapter/deno/conninfo.ts"]
  n32["adapter/deno/deno.d.ts"]
  n33["adapter/deno/index.ts"]
  n34["adapter/deno/serve-static.ts"]
  n35["adapter/deno/ssg.ts"]
  n36["adapter/deno/websocket.test.ts"]
  n37["adapter/deno/websocket.ts"]
  n38["adapter/lambda-edge/conninfo.test.ts"]
  n39["adapter/lambda-edge/conninfo.ts"]
  n40["adapter/lambda-edge/handler.test.ts"]
  n41["adapter/lambda-edge/handler.ts"]
  n42["adapter/lambda-edge/index.ts"]
  n43["adapter/netlify/conninfo.test.ts"]
  n44["adapter/netlify/conninfo.ts"]
  n45["adapter/netlify/handler.ts"]
  n46["adapter/netlify/index.ts"]
  n47["adapter/netlify/mod.ts"]
  n48["adapter/service-worker/handler.test.ts"]
  n49["adapter/service-worker/handler.ts"]
  n50["adapter/service-worker/index.ts"]
  n51["adapter/service-worker/types.ts"]
  n52["adapter/vercel/conninfo.test.ts"]
  n53["adapter/vercel/conninfo.ts"]
  n54["adapter/vercel/handler.test.ts"]
  n55["adapter/vercel/handler.ts"]
  n56["adapter/vercel/index.ts"]
  n57["client/client.test.ts"]
  n58["client/client.ts"]
  n59["client/fetch-result-please.ts"]
  n60["client/index.ts"]
  n61["client/types.test.ts"]
  n62["client/types.ts"]
  n63["client/utils.test.ts"]
  n64["client/utils.ts"]
  n65["compose.test.ts"]
  n66["compose.ts"]
  n67["context.test.ts"]
  n68["context.ts"]
  n69["helper/accepts/accepts.test.ts"]
  n70["helper/accepts/accepts.ts"]
  n71["helper/accepts/index.ts"]
  n72["helper/adapter/index.test.ts"]
  n73["helper/adapter/index.ts"]
  n74["helper/conninfo/index.ts"]
  n75["helper/conninfo/types.ts"]
  n76["helper/cookie/index.test.ts"]
  n77["helper/cookie/index.ts"]
  n78["helper/css/common.case.test.tsx"]
  n79["helper/css/common.ts"]
  n80["helper/css/index.test.tsx"]
  n81["helper/css/index.ts"]
  n82["helper/dev/index.test.ts"]
  n83["helper/dev/index.ts"]
  n84["helper/factory/index.test.ts"]
  n85["helper/factory/index.ts"]
  n86["helper/html/index.test.ts"]
  n87["helper/html/index.ts"]
  n88["helper/proxy/index.test.ts"]
  n89["helper/proxy/index.ts"]
  n90["helper/route/index.test.ts"]
  n91["helper/route/index.ts"]
  n92["helper/ssg/index.ts"]
  n93["helper/ssg/middleware.ts"]
  n94["helper/ssg/plugins.test.tsx"]
  n95["helper/ssg/plugins.ts"]
  n96["helper/ssg/ssg.test.tsx"]
  n97["helper/ssg/ssg.ts"]
  n98["helper/ssg/utils.test.ts"]
  n99["helper/ssg/utils.ts"]
  n100["helper/streaming/index.ts"]
  n101["helper/streaming/sse.test.tsx"]
  n102["helper/streaming/sse.ts"]
  n103["helper/streaming/stream.test.ts"]
  n104["helper/streaming/stream.ts"]
  n105["helper/streaming/text.test.ts"]
  n106["helper/streaming/text.ts"]
  n107["helper/streaming/utils.ts"]
  n108["helper/testing/index.test.ts"]
  n109["helper/testing/index.ts"]
  n110["helper/websocket/index.test.ts"]
  n111["helper/websocket/index.ts"]
  n112["hono-base.ts"]
  n113["hono.test.ts"]
  n114["hono.ts"]
  n115["http-exception.test.ts"]
  n116["http-exception.ts"]
  n117["index.ts"]
  n118["jsx/base.test.tsx"]
  n119["jsx/base.ts"]
  n120["jsx/children.test.ts"]
  n121["jsx/children.ts"]
  n122["jsx/components.test.tsx"]
  n123["jsx/components.ts"]
  n124["jsx/constants.ts"]
  n125["jsx/context-isolation.test.ts"]
  n126["jsx/context.ts"]
  n127["jsx/dom/client.test.tsx"]
  n128["jsx/dom/client.ts"]
  n129["jsx/dom/components.test.tsx"]
  n130["jsx/dom/components.ts"]
  n131["jsx/dom/context.test.tsx"]
  n132["jsx/dom/context.ts"]
  n133["jsx/dom/css.test.tsx"]
  n134["jsx/dom/css.ts"]
  n135["jsx/dom/hooks/index.test.tsx"]
  n136["jsx/dom/hooks/index.ts"]
  n137["jsx/dom/index.test.tsx"]
  n138["jsx/dom/index.ts"]
  n139["jsx/dom/intrinsic-element/components.test.tsx"]
  n140["jsx/dom/intrinsic-element/components.ts"]
  n141["jsx/dom/jsx-dev-runtime.ts"]
  n142["jsx/dom/jsx-runtime.ts"]
  n143["jsx/dom/render.ts"]
  n144["jsx/dom/server.test.tsx"]
  n145["jsx/dom/server.ts"]
  n146["jsx/dom/utils.ts"]
  n147["jsx/hooks/dom.test.tsx"]
  n148["jsx/hooks/index.ts"]
  n149["jsx/hooks/string.test.tsx"]
  n150["jsx/index.test.tsx"]
  n151["jsx/index.ts"]
  n152["jsx/intrinsic-element/common.ts"]
  n153["jsx/intrinsic-element/components.test.tsx"]
  n154["jsx/intrinsic-element/components.ts"]
  n155["jsx/intrinsic-elements.ts"]
  n156["jsx/jsx-dev-runtime.ts"]
  n157["jsx/jsx-runtime.test.tsx"]
  n158["jsx/jsx-runtime.ts"]
  n159["jsx/streaming.test.tsx"]
  n160["jsx/streaming.ts"]
  n161["jsx/types.ts"]
  n162["jsx/utils.test.ts"]
  n163["jsx/utils.ts"]
  n164["middleware/basic-auth/index.test.ts"]
  n165["middleware/basic-auth/index.ts"]
  n166["middleware/bearer-auth/index.test.ts"]
  n167["middleware/bearer-auth/index.ts"]
  n168["middleware/body-limit/index.test.ts"]
  n169["middleware/body-limit/index.ts"]
  n170["middleware/cache/index.test.ts"]
  n171["middleware/cache/index.ts"]
  n172["middleware/combine/index.test.ts"]
  n173["middleware/combine/index.ts"]
  n174["middleware/compress/index.test.ts"]
  n175["middleware/compress/index.ts"]
  n176["middleware/context-storage/index.test.ts"]
  n177["middleware/context-storage/index.ts"]
  n178["middleware/cors/index.test.ts"]
  n179["middleware/cors/index.ts"]
  n180["middleware/csrf/index.test.ts"]
  n181["middleware/csrf/index.ts"]
  n182["middleware/etag/digest.test.ts"]
  n183["middleware/etag/digest.ts"]
  n184["middleware/etag/index.test.ts"]
  n185["middleware/etag/index.ts"]
  n186["middleware/ip-restriction/index.test.ts"]
  n187["middleware/ip-restriction/index.ts"]
  n188["middleware/jsx-renderer/index.test.tsx"]
  n189["middleware/jsx-renderer/index.ts"]
  n190["middleware/jwk/index.test.ts"]
  n191["middleware/jwk/index.ts"]
  n192["middleware/jwk/jwk.ts"]
  n193["middleware/jwt/index.test.ts"]
  n194["middleware/jwt/index.ts"]
  n195["middleware/jwt/jwt.ts"]
  n196["middleware/language/index.test.ts"]
  n197["middleware/language/index.ts"]
  n198["middleware/language/language.ts"]
  n199["middleware/logger/index.test.ts"]
  n200["middleware/logger/index.ts"]
  n201["middleware/method-not-allowed/index.test.ts"]
  n202["middleware/method-not-allowed/index.ts"]
  n203["middleware/method-override/index.test.ts"]
  n204["middleware/method-override/index.ts"]
  n205["middleware/mount/index.test.ts"]
  n206["middleware/mount/index.ts"]
  n207["middleware/powered-by/index.test.ts"]
  n208["middleware/powered-by/index.ts"]
  n209["middleware/pretty-json/index.test.ts"]
  n210["middleware/pretty-json/index.ts"]
  n211["middleware/request-id/index.test.ts"]
  n212["middleware/request-id/index.ts"]
  n213["middleware/request-id/request-id.ts"]
  n214["middleware/secure-headers/index.test.ts"]
  n215["middleware/secure-headers/index.ts"]
  n216["middleware/secure-headers/permissions-policy.ts"]
  n217["middleware/secure-headers/secure-headers.ts"]
  n218["middleware/serve-static/index.test.ts"]
  n219["middleware/serve-static/index.ts"]
  n220["middleware/serve-static/path.test.ts"]
  n221["middleware/serve-static/path.ts"]
  n222["middleware/timeout/index.test.ts"]
  n223["middleware/timeout/index.ts"]
  n224["middleware/timing/index.test.ts"]
  n225["middleware/timing/index.ts"]
  n226["middleware/timing/timing.ts"]
  n227["middleware/trailing-slash/index.test.ts"]
  n228["middleware/trailing-slash/index.ts"]
  n229["preset/quick.test.ts"]
  n230["preset/quick.ts"]
  n231["preset/tiny.test.ts"]
  n232["preset/tiny.ts"]
  n233["request.test.ts"]
  n234["request.ts"]
  n235["request/constants.ts"]
  n236["router.ts"]
  n237["router/common.case.test.ts"]
  n238["router/linear-router/index.ts"]
  n239["router/linear-router/router.test.ts"]
  n240["router/linear-router/router.ts"]
  n241["router/pattern-router/index.ts"]
  n242["router/pattern-router/router.test.ts"]
  n243["router/pattern-router/router.ts"]
  n244["router/reg-exp-router/index.ts"]
  n245["router/reg-exp-router/matcher.ts"]
  n246["router/reg-exp-router/node.ts"]
  n247["router/reg-exp-router/prepared-router.test.ts"]
  n248["router/reg-exp-router/prepared-router.ts"]
  n249["router/reg-exp-router/router.test.ts"]
  n250["router/reg-exp-router/router.ts"]
  n251["router/reg-exp-router/trie.ts"]
  n252["router/smart-router/index.ts"]
  n253["router/smart-router/router.test.ts"]
  n254["router/smart-router/router.ts"]
  n255["router/trie-router/index.ts"]
  n256["router/trie-router/node.test.ts"]
  n257["router/trie-router/node.ts"]
  n258["router/trie-router/router.test.ts"]
  n259["router/trie-router/router.ts"]
  n260["router/utils.ts"]
  n261["types.test.ts"]
  n262["types.ts"]
  n263["utils/accept.test.ts"]
  n264["utils/accept.ts"]
  n265["utils/basic-auth.test.ts"]
  n266["utils/basic-auth.ts"]
  n267["utils/body.test.ts"]
  n268["utils/body.ts"]
  n269["utils/buffer.test.ts"]
  n270["utils/buffer.ts"]
  n271["utils/color.test.ts"]
  n272["utils/color.ts"]
  n273["utils/compress.ts"]
  n274["utils/concurrent.test.ts"]
  n275["utils/concurrent.ts"]
  n276["utils/constants.ts"]
  n277["utils/cookie.test.ts"]
  n278["utils/cookie.ts"]
  n279["utils/crypto.test.ts"]
  n280["utils/crypto.ts"]
  n281["utils/encode.test.ts"]
  n282["utils/encode.ts"]
  n283["utils/filepath.test.ts"]
  n284["utils/filepath.ts"]
  n285["utils/handler.ts"]
  n286["utils/headers.ts"]
  n287["utils/html.test.ts"]
  n288["utils/html.ts"]
  n289["utils/http-status.ts"]
  n290["utils/ipaddr.test.ts"]
  n291["utils/ipaddr.ts"]
  n292["utils/jwt/index.ts"]
  n293["utils/jwt/jwa.test.ts"]
  n294["utils/jwt/jwa.ts"]
  n295["utils/jwt/jws.ts"]
  n296["utils/jwt/jwt.test.ts"]
  n297["utils/jwt/jwt.ts"]
  n298["utils/jwt/types.ts"]
  n299["utils/jwt/utf8.ts"]
  n300["utils/mime.test.ts"]
  n301["utils/mime.ts"]
  n302["utils/stream.test.ts"]
  n303["utils/stream.ts"]
  n304["utils/types.test.ts"]
  n305["utils/types.ts"]
  n306["utils/url.test.ts"]
  n307["utils/url.ts"]
  n308["validator/index.ts"]
  n309["validator/utils.test.ts"]
  n310["validator/utils.ts"]
  n311["validator/validator.test.ts"]
  n312["validator/validator.ts"]
  n0 --> n68
  n0 --> n1
  n1 --> n68
  n1 --> n5
  n2 --> n114
  n2 --> n3
  n2 --> n3
  n2 --> n5
  n3 --> n114
  n3 --> n262
  n3 --> n282
  n3 --> n5
  n4 --> n3
  n4 --> n1
  n4 --> n3
  n4 --> n5
  n6 --> n68
  n6 --> n7
  n7 --> n11
  n8 --> n9
  n8 --> n12
  n8 --> n14
  n8 --> n14
  n8 --> n7
  n8 --> n11
  n9 --> n262
  n10 --> n68
  n10 --> n11
  n11 --> n68
  n13 --> n68
  n13 --> n14
  n13 --> n14
  n14 --> n11
  n15 --> n68
  n15 --> n16
  n17 --> n114
  n17 --> n116
  n17 --> n18
  n17 --> n18
  n18 --> n68
  n18 --> n114
  n18 --> n116
  n18 --> n262
  n19 --> n18
  n19 --> n16
  n19 --> n18
  n20 --> n68
  n20 --> n21
  n22 --> n23
  n22 --> n29
  n22 --> n21
  n23 --> n262
  n23 --> n25
  n23 --> n25
  n24 --> n68
  n24 --> n114
  n24 --> n262
  n24 --> n25
  n25 --> n262
  n25 --> n27
  n26 --> n27
  n28 --> n68
  n30 --> n68
  n30 --> n31
  n33 --> n34
  n33 --> n35
  n33 --> n37
  n33 --> n31
  n34 --> n262
  n35 --> n92
  n35 --> n92
  n36 --> n68
  n36 --> n37
  n38 --> n68
  n38 --> n39
  n38 --> n41
  n39 --> n68
  n39 --> n41
  n40 --> n114
  n40 --> n282
  n40 --> n41
  n40 --> n41
  n41 --> n114
  n41 --> n282
  n42 --> n41
  n42 --> n39
  n42 --> n41
  n43 --> n68
  n43 --> n44
  n44 --> n68
  n45 --> n114
  n46 --> n47
  n47 --> n45
  n47 --> n44
  n48 --> n114
  n48 --> n49
  n48 --> n51
  n49 --> n114
  n49 --> n262
  n49 --> n51
  n50 --> n114
  n50 --> n262
  n50 --> n49
  n50 --> n49
  n52 --> n68
  n52 --> n53
  n54 --> n114
  n54 --> n55
  n55 --> n114
  n56 --> n55
  n56 --> n53
  n57 --> n37
  n57 --> n114
  n57 --> n278
  n57 --> n305
  n57 --> n58
  n57 --> n62
  n58 --> n114
  n58 --> n262
  n58 --> n278
  n58 --> n305
  n58 --> n62
  n58 --> n64
  n60 --> n58
  n60 --> n64
  n60 --> n62
  n61 --> n37
  n61 --> n62
  n62 --> n114
  n62 --> n112
  n62 --> n236
  n62 --> n262
  n62 --> n289
  n62 --> n305
  n63 --> n114
  n63 --> n305
  n63 --> n58
  n63 --> n64
  n64 --> n289
  n64 --> n59
  n64 --> n62
  n65 --> n66
  n65 --> n68
  n65 --> n236
  n65 --> n262
  n66 --> n68
  n66 --> n262
  n67 --> n68
  n68 --> n234
  n68 --> n236
  n68 --> n262
  n68 --> n286
  n68 --> n288
  n68 --> n289
  n68 --> n301
  n68 --> n305
  n69 --> n264
  n69 --> n286
  n69 --> n70
  n69 --> n70
  n70 --> n68
  n70 --> n264
  n70 --> n286
  n71 --> n70
  n73 --> n68
  n74 --> n75
  n75 --> n68
  n77 --> n68
  n77 --> n278
  n77 --> n278
  n78 --> n81
  n80 --> n160
  n80 --> n288
  n80 --> n288
  n80 --> n81
  n81 --> n124
  n81 --> n134
  n81 --> n288
  n81 --> n288
  n81 --> n79
  n81 --> n79
  n81 --> n79
  n81 --> n79
  n82 --> n262
  n83 --> n114
  n83 --> n262
  n83 --> n272
  n83 --> n285
  n84 --> n62
  n84 --> n117
  n84 --> n262
  n84 --> n289
  n84 --> n305
  n84 --> n85
  n85 --> n114
  n85 --> n112
  n85 --> n262
  n87 --> n288
  n87 --> n288
  n89 --> n116
  n89 --> n286
  n90 --> n114
  n91 --> n68
  n91 --> n235
  n91 --> n262
  n91 --> n307
  n92 --> n97
  n92 --> n93
  n92 --> n95
  n93 --> n68
  n93 --> n262
  n93 --> n99
  n94 --> n114
  n94 --> n289
  n94 --> n95
  n94 --> n97
  n94 --> n97
  n95 --> n97
  n96 --> n114
  n96 --> n93
  n96 --> n97
  n96 --> n97
  n97 --> n64
  n97 --> n114
  n97 --> n262
  n97 --> n275
  n97 --> n301
  n97 --> n93
  n97 --> n93
  n97 --> n95
  n97 --> n99
  n98 --> n99
  n99 --> n114
  n99 --> n236
  n99 --> n262
  n99 --> n285
  n100 --> n104
  n100 --> n102
  n100 --> n102
  n100 --> n106
  n102 --> n68
  n102 --> n288
  n102 --> n303
  n102 --> n107
  n104 --> n68
  n104 --> n303
  n104 --> n107
  n106 --> n68
  n106 --> n68
  n106 --> n303
  n109 --> n62
  n109 --> n68
  n109 --> n114
  n109 --> n262
  n109 --> n305
  n111 --> n68
  n111 --> n262
  n111 --> n289
  n112 --> n66
  n112 --> n68
  n112 --> n68
  n112 --> n236
  n112 --> n236
  n112 --> n262
  n112 --> n276
  n112 --> n307
  n113 --> n68
  n113 --> n114
  n113 --> n116
  n113 --> n262
  n113 --> n305
  n113 --> n307
  n114 --> n112
  n114 --> n112
  n114 --> n262
  n115 --> n116
  n116 --> n289
  n117 --> n114
  n117 --> n262
  n117 --> n68
  n117 --> n68
  n117 --> n234
  n118 --> n288
  n118 --> n119
  n118 --> n119
  n119 --> n288
  n119 --> n288
  n119 --> n124
  n119 --> n126
  n119 --> n126
  n119 --> n152
  n119 --> n154
  n119 --> n155
  n119 --> n163
  n121 --> n119
  n122 --> n288
  n122 --> n288
  n122 --> n123
  n122 --> n160
  n123 --> n288
  n123 --> n288
  n123 --> n119
  n123 --> n124
  n123 --> n126
  n123 --> n130
  n123 --> n143
  n123 --> n160
  n125 --> n151
  n125 --> n160
  n126 --> n288
  n126 --> n119
  n126 --> n124
  n126 --> n132
  n128 --> n119
  n128 --> n143
  n128 --> n143
  n130 --> n123
  n130 --> n124
  n130 --> n142
  n132 --> n119
  n132 --> n124
  n132 --> n126
  n132 --> n126
  n132 --> n146
  n133 --> n79
  n134 --> n79
  n134 --> n79
  n134 --> n79
  n136 --> n124
  n136 --> n126
  n136 --> n126
  n136 --> n132
  n137 --> n143
  n137 --> n143
  n138 --> n119
  n138 --> n119
  n138 --> n121
  n138 --> n124
  n138 --> n126
  n138 --> n130
  n138 --> n132
  n138 --> n142
  n138 --> n143
  n138 --> n143
  n138 --> n126
  n138 --> n126
  n138 --> n126
  n138 --> n161
  n139 --> n140
  n140 --> n119
  n140 --> n126
  n140 --> n152
  n140 --> n155
  n140 --> n161
  n140 --> n143
  n140 --> n143
  n141 --> n119
  n141 --> n119
  n141 --> n140
  n142 --> n141
  n142 --> n141
  n142 --> n141
  n143 --> n119
  n143 --> n121
  n143 --> n124
  n143 --> n126
  n143 --> n126
  n143 --> n163
  n143 --> n132
  n144 --> n145
  n145 --> n288
  n145 --> n119
  n145 --> n119
  n145 --> n160
  n146 --> n124
  n148 --> n119
  n148 --> n124
  n148 --> n143
  n148 --> n143
  n150 --> n114
  n150 --> n124
  n150 --> n126
  n150 --> n160
  n151 --> n119
  n151 --> n119
  n151 --> n121
  n151 --> n123
  n151 --> n126
  n151 --> n160
  n151 --> n161
  n151 --> n161
  n151 --> n161
  n151 --> n155
  n152 --> n119
  n153 --> n288
  n154 --> n288
  n154 --> n119
  n154 --> n119
  n154 --> n121
  n154 --> n124
  n154 --> n126
  n154 --> n155
  n154 --> n161
  n154 --> n152
  n155 --> n301
  n155 --> n305
  n156 --> n288
  n156 --> n119
  n156 --> n119
  n156 --> n119
  n156 --> n119
  n157 --> n114
  n157 --> n158
  n158 --> n156
  n158 --> n156
  n158 --> n156
  n158 --> n288
  n158 --> n288
  n158 --> n163
  n159 --> n288
  n159 --> n288
  n159 --> n126
  n159 --> n143
  n159 --> n160
  n160 --> n288
  n160 --> n288
  n160 --> n119
  n160 --> n123
  n160 --> n124
  n160 --> n126
  n160 --> n130
  n160 --> n143
  n160 --> n143
  n161 --> n119
  n161 --> n155
  n161 --> n119
  n161 --> n126
  n162 --> n163
  n165 --> n68
  n165 --> n116
  n165 --> n262
  n165 --> n266
  n165 --> n270
  n166 --> n117
  n167 --> n68
  n167 --> n116
  n167 --> n262
  n167 --> n270
  n167 --> n289
  n169 --> n68
  n169 --> n116
  n169 --> n262
  n170 --> n114
  n171 --> n68
  n171 --> n234
  n171 --> n262
  n171 --> n280
  n171 --> n289
  n172 --> n262
  n173 --> n66
  n173 --> n68
  n173 --> n236
  n173 --> n262
  n174 --> n114
  n175 --> n262
  n175 --> n264
  n175 --> n273
  n177 --> n68
  n177 --> n262
  n178 --> n114
  n179 --> n68
  n179 --> n262
  n180 --> n68
  n180 --> n114
  n181 --> n68
  n181 --> n116
  n181 --> n262
  n182 --> n183
  n185 --> n262
  n185 --> n183
  n186 --> n114
  n187 --> n116
  n187 --> n291
  n187 --> n291
  n188 --> n114
  n188 --> n160
  n189 --> n68
  n189 --> n160
  n189 --> n262
  n190 --> n114
  n190 --> n116
  n190 --> n282
  n190 --> n295
  n190 --> n295
  n190 --> n297
  n190 --> n298
  n190 --> n299
  n191 --> n192
  n192 --> n68
  n192 --> n116
  n192 --> n262
  n192 --> n278
  n192 --> n68
  n192 --> n294
  n192 --> n295
  n192 --> n297
  n193 --> n116
  n194 --> n195
  n194 --> n195
  n194 --> n195
  n194 --> n294
  n195 --> n68
  n195 --> n116
  n195 --> n262
  n195 --> n278
  n195 --> n68
  n195 --> n294
  n195 --> n295
  n195 --> n297
  n196 --> n198
  n197 --> n198
  n197 --> n198
  n197 --> n198
  n198 --> n68
  n198 --> n262
  n198 --> n264
  n200 --> n262
  n200 --> n272
  n202 --> n68
  n202 --> n114
  n202 --> n236
  n202 --> n262
  n203 --> n114
  n203 --> n204
  n204 --> n68
  n204 --> n114
  n204 --> n262
  n204 --> n268
  n205 --> n114
  n205 --> n307
  n206 --> n68
  n206 --> n262
  n208 --> n262
  n210 --> n262
  n211 --> n114
  n212 --> n213
  n212 --> n213
  n212 --> n213
  n213 --> n68
  n213 --> n262
  n215 --> n217
  n215 --> n217
  n215 --> n217
  n217 --> n68
  n217 --> n262
  n217 --> n282
  n217 --> n216
  n219 --> n68
  n219 --> n262
  n219 --> n264
  n219 --> n273
  n219 --> n301
  n219 --> n307
  n219 --> n221
  n220 --> n221
  n222 --> n114
  n222 --> n116
  n223 --> n68
  n223 --> n116
  n223 --> n262
  n225 --> n226
  n225 --> n226
  n225 --> n226
  n226 --> n68
  n226 --> n262
  n226 --> n68
  n228 --> n262
  n229 --> n230
  n230 --> n112
  n230 --> n112
  n230 --> n262
  n231 --> n232
  n232 --> n112
  n232 --> n112
  n232 --> n262
  n233 --> n116
  n233 --> n234
  n233 --> n262
  n234 --> n116
  n234 --> n235
  n234 --> n236
  n234 --> n262
  n234 --> n268
  n234 --> n268
  n234 --> n286
  n234 --> n305
  n234 --> n307
  n237 --> n236
  n238 --> n240
  n239 --> n236
  n239 --> n240
  n240 --> n236
  n240 --> n236
  n240 --> n307
  n241 --> n243
  n242 --> n236
  n242 --> n243
  n243 --> n236
  n243 --> n236
  n244 --> n250
  n244 --> n248
  n245 --> n236
  n245 --> n236
  n246 --> n260
  n247 --> n236
  n247 --> n248
  n248 --> n236
  n248 --> n236
  n248 --> n245
  n248 --> n245
  n248 --> n250
  n249 --> n236
  n249 --> n236
  n249 --> n250
  n250 --> n236
  n250 --> n236
  n250 --> n307
  n250 --> n260
  n250 --> n245
  n250 --> n245
  n250 --> n246
  n250 --> n251
  n251 --> n260
  n251 --> n246
  n251 --> n246
  n252 --> n254
  n253 --> n254
  n254 --> n236
  n254 --> n236
  n255 --> n259
  n256 --> n257
  n257 --> n236
  n257 --> n236
  n257 --> n307
  n257 --> n307
  n257 --> n260
  n258 --> n259
  n259 --> n236
  n259 --> n307
  n259 --> n257
  n261 --> n68
  n261 --> n114
  n261 --> n262
  n261 --> n289
  n261 --> n305
  n262 --> n68
  n262 --> n112
  n262 --> n286
  n262 --> n289
  n262 --> n305
  n263 --> n264
  n265 --> n266
  n266 --> n282
  n267 --> n268
  n267 --> n268
  n268 --> n234
  n268 --> n270
  n269 --> n270
  n270 --> n280
  n271 --> n272
  n274 --> n275
  n277 --> n278
  n277 --> n278
  n278 --> n307
  n279 --> n280
  n280 --> n305
  n281 --> n282
  n283 --> n284
  n285 --> n276
  n287 --> n288
  n287 --> n288
  n290 --> n291
  n292 --> n297
  n293 --> n294
  n293 --> n294
  n295 --> n282
  n295 --> n294
  n295 --> n298
  n295 --> n299
  n296 --> n282
  n296 --> n294
  n296 --> n295
  n296 --> n295
  n296 --> n297
  n296 --> n297
  n296 --> n298
  n296 --> n299
  n297 --> n282
  n297 --> n294
  n297 --> n294
  n297 --> n295
  n297 --> n295
  n297 --> n298
  n297 --> n298
  n297 --> n299
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n298 --> n295
  n300 --> n301
  n302 --> n303
  n304 --> n305
  n306 --> n307
  n308 --> n312
  n308 --> n312
  n308 --> n310
  n309 --> n310
  n310 --> n262
  n310 --> n305
  n311 --> n68
  n311 --> n114
  n311 --> n116
  n311 --> n234
  n311 --> n262
  n311 --> n289
  n311 --> n305
  n311 --> n312
  n311 --> n312
  n312 --> n68
  n312 --> n116
  n312 --> n262
  n312 --> n268
  n312 --> n270
  n312 --> n310
  %% cycle: context.ts -> request.ts -> types.ts -> context.ts
  %% cycle: context.ts -> request.ts -> types.ts -> hono-base.ts -> compose.ts -> context.ts
  %% cycle: types.ts -> hono-base.ts -> compose.ts -> types.ts
  %% cycle: context.ts -> request.ts -> types.ts -> hono-base.ts -> context.ts
  %% cycle: types.ts -> hono-base.ts -> types.ts
  %% cycle: request.ts -> utils/body.ts -> request.ts
  %% cycle: helper/ssg/ssg.ts -> helper/ssg/plugins.ts -> helper/ssg/ssg.ts
  %% cycle: jsx/base.ts -> jsx/context.ts -> jsx/base.ts
  %% cycle: jsx/base.ts -> jsx/context.ts -> jsx/dom/context.ts -> jsx/base.ts
  %% cycle: jsx/context.ts -> jsx/dom/context.ts -> jsx/context.ts
  %% cycle: jsx/base.ts -> jsx/intrinsic-element/common.ts -> jsx/base.ts
  %% cycle: jsx/base.ts -> jsx/intrinsic-element/components.ts -> jsx/base.ts
  %% cycle: jsx/base.ts -> jsx/intrinsic-element/components.ts -> jsx/children.ts -> jsx/base.ts
  %% cycle: jsx/base.ts -> jsx/intrinsic-element/components.ts -> jsx/types.ts -> jsx/base.ts
  %% cycle: jsx/components.ts -> jsx/dom/components.ts -> jsx/components.ts
  %% cycle: jsx/streaming.ts -> jsx/components.ts -> jsx/streaming.ts
  %% cycle: utils/jwt/jws.ts -> utils/jwt/types.ts -> utils/jwt/jws.ts
```

## Limits

- Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 runs only the generated test, on a git-archive snapshot, inside a permission-model sandbox (no network, no writes, 2 s timeout); isolation is process-level, not OS-level.
- No completeness claim; this report shows what passed the gate, not everything that exists in the repository.
- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- The L1 gate proves that a citation exists in the commit; the semantic match is judged by the verifier model and presented as such.

