# HAND-CHECK — jsesc (regression)

**Repo:** https://github.com/mathiasbynens/jsesc @ `e3349b542eaaf55239cb60519991b80097cee24b` (local clone from A1/A2; `analysis-target/jsesc.js` sha256 `03c367cb…`) · scope `analysis-target` (1 f./337 LOC)
**Run:** `ea5b1ae7f3eeac48` ($0.6289, 2 verified — 1 patch-proven, 1 verified, 1 uncertain)
**Purpose:** L3/L4 regression on the same target as v0.2.2.

| Run / ID | Claim | Verdict | Severity | Evidence |
|---|---|---|---|---|
| F-001 `jsesc.js:216-225` | Negative numbers in hex/bin/oct produce `0x-A` instead of `-0xA` | **REAL — patch-proven** | **medium** | `result = '0x' + argument.toString(16)`; `(-255).toString(16) = "-ff"` → `"0x-ff"` — an invalid JS literal. Execution proof (reproduced + patch-proven). Same defect as in v0.2.2 (upstream issue #79). |
| F-002 `jsesc.js:214-226` | An unknown `numbers` option returns `undefined` | **REAL (manually confirmed; the system left it `uncertain`)** | **low** | If `options.numbers` is not dec/hex/bin/oct, `result` stays `undefined` and the function returns `undefined` (or `"undefinedn"` for BigInt) instead of an error or a string. Input-option validation is missing. Not published as verified — it stays in the rejected/uncertain trace. |
| F-003 `jsesc.js:203` | The second `isBigInt` branch is dead | **REAL (dead code)** | **informational** | `if (isNumber(argument) || isBigInt(argument)) { … } else if (isBigInt(argument)) { … }` — the second branch is never executed. Does not change behaviour. |

**Final:** regression confirmed (patch-proven L4 works); 2 real + 1 dead code + 1 uncertain manually confirmed. Upstream status: jsesc #79 (open), PR #80 partial fix.
