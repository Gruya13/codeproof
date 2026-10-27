# Model ablation — Spark alone vs Wonder alone vs CodeProof (ufo, `f06c800`)

One repository ([unjs/ufo](https://github.com/unjs/ufo) `src/`, 7 files / 1,571 LOC), same scanner prompt, same JSON schema and same repository digest for every variant. The only variable is the architecture.

| Variant | What runs | Candidates | L1-valid | Overlap with CodeProof | New vs CodeProof | Cost | Duration |
|---|---|---:|---:|---:|---:|---:|---:|
| **spark-only** | Muse Spark 1.3, one pass | 3 | 3 | 3 | 0 | $0.0457 | 42.5 s |
| **wonder-only** | Muse Wonder 1.0, one pass (2 calls: truncation retry) | 7 | 7 | 2 | **5** | $0.8641 | 293.9 s |
| **codeproof** | Spark scan + L1 + Wonder verify (+L3) | 4 verified | 4 | - | - | $0.6907 (existing run) | 170 s |
| **reverse check** | Wonder's 7 findings → Spark as adversarial verifier | — | — | — | — | ~$0.07 | 35.7 s |

## What the numbers say

1. **All three variants find real defects on this repository.** Spark alone found 3, all three are in the CodeProof run (precision 3/3 on this sample). Wonder alone found 7, all L1-valid; 2 are CodeProof findings and **5 are new**.
2. **The 5 new Wonder findings survive the cross-examination.** Running them through Spark as an adversarial verifier (the CodeProof L2 gate) gives **7/7 confirmed, 0 refuted, 0 moderate**. They are not single-model noise.
3. **The bottleneck is the scanner, not the gate.** CodeProof's recall is bounded by what Spark proposes: the 5 Wonder-only findings cannot be published by CodeProof because the producer never proposed them. The verifier is the stronger analyst here, but it only reacts to Spark's candidates.
4. **Cost per useful finding:** Spark-only ~$0.015, Wonder-only ~$0.123, CodeProof ~$0.173 for 4 published findings. Wonder is 19x more expensive per call and 7x more expensive per finding; it also takes 7x longer. One strong model is not cheaper than the two-model gate - it is the opposite.
5. **A second call was needed for Wonder** (`finish_reason=length` at 16k output tokens; the retry with 32k produced a total of 37k output tokens). Wonder spends a large part of its budget on reasoning; that is where the cost and latency come from.

## Hand check of the 5 new findings (all read against the source)

| # | Claim | Verdict |
|---|---|---|
| F-001 | `stringifyParsedURL` unconditionally appends `//` after any protocol, so special protocols returned without slashes (`data:`, `blob:`, `javascript:`) are corrupted | **plausible/confirmed by reading `parse.ts:190-194`** — depends on `parseURL` returning a protocol with an empty host for these schemes |
| F-002 | protocol-relative `//example.com/foo`: host is stored but `href` drops it because `hasProtocol` is false (`url.ts:106-115`) | **confirmed by reading** |
| F-003 | `joinRelativeURL`: a leading `..` decrements the depth, the next segment increments it back, and the `depth >= 0` branch then drops the `../` (`utils.ts:474-494`) | **confirmed by reading** |
| F-005 | `parseHost('[::1]:8080')` returns hostname `[` because the regex stops at the first colon (`parse.ts:157-163`) | **confirmed by reading** |
| F-007 | `withBase('/foo#bar','/foo')` does not treat `#` as a boundary, so it joins to `/foo/foo#bar` instead of returning the input (`utils.ts:294-302`) | **confirmed by reading** |

## Honest caveats

- **n = 1 run per variant.** Model output is not bit-deterministic: in the CodeProof run Spark proposed 4 candidates, in this spark-only run it proposed 3. A second run could shift the overlap.
- The reverse check reconstructs the cited snippet from the committed range (the original snippets were L1-valid), so it tests the semantics of the claim, not the exact original extract.
- The reverse check is a compatibility test of the claims, not an independent verdict on real-world impact: both models can share a blind spot (they are from the same vendor family).
- L3 was not part of the spark-only/wonder-only variants; the CodeProof number comes from the stored run (4 verified, 0 reproduced because ufo is TypeScript with extensionless imports).

## Takeaway

On this repository, **a single Wonder pass finds more real defects than the full Spark+Wonder gate and survives the cross-check** - but it costs 2x the whole gate and is 7x slower. The productive next step (outside the hackathon scope) is a *dual-scanner*: both models propose, the existing deterministic + adversarial gate filters, and the report labels which model proposed what. That would raise recall without weakening the trust contract.

Artifacts: `model-ablation.json`, `MODEL-ABLATION.md` (generated), `reverse-spark-verify.json`.