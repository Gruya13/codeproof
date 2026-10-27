# Dual-scanner mode — first real run (ufo, 27.10.2026)

`DUAL_SCAN=1` on [unjs/ufo](https://github.com/unjs/ufo) `src/` at commit `f06c800` — the same target and commit as the single-scanner CodeProof run `deb844e0328b6a39` in [../probes-27-10b/ufo/](../probes-27-10b/ufo/), so the two runs are directly comparable.

| | Single scanner (existing run) | **Dual scanner** |
|---|---:|---:|
| Candidates proposed | 4 (Spark) | **10 unique** (Spark 4, Wonder 8, both 2) |
| Published (verified) | 4 | **10** |
| Refuted / moderate / uncertain | 0 / 0 / 0 | 0 / 0 / 0 |
| Rejected at L1 | 0 | 0 |
| Execution-proven | 0 (L3 unavailable: extensionless TS imports) | 0 (same) |
| Cost | $0.6907 | **$2.0685** |
| Duration | 170 s | 656 s |

Per scanner (`run.json.scanners`): Spark 4 candidates, $0.0615, 37 s; Wonder 8 candidates, $0.6412, 353 s (one truncation retry at 32k output tokens, 294 s of it in the second call).

## What the second scanner added

Six findings that the single-scanner pipeline could not publish, because the Spark producer never proposed them. Each was cross-examined by Spark as the verifier (`muse-spark-1.3`) and confirmed:

| # | Proposed by | Finding |
|---|---|---|
| F-005 | Wonder | `parseURL` loses opaque-protocol URLs such as `mailto:foo@example.com`: `hasProtocol` accepts a scheme without `//`, but the following match requires `//` |
| F-006 | Wonder | `joinRelativeURL("../a", "b")` returns `"a/b"` instead of `"../a/b"` (the `..` decrements the depth, the next segment increments it back) |
| F-007 | Wonder | `stringifyParsedURL(parseURL("data:text/plain,hello"))` produces `data://text/plain,hello` (unconditional `//` after any protocol) |
| F-008 | Wonder | `new $URL("//example.com/foo").href` returns `/foo` and loses the host (protocol-relative URL, `hasProtocol` false) |
| F-009 | Wonder | `parseHost("[::1]:8080")` returns hostname `[` and no port (the regex stops at the first colon inside IPv6 brackets) |
| F-010 | Wonder | `withoutBase("/foo#section", "/foo")` returns the input unchanged instead of `/#section` (`#` is not accepted as a base boundary) |

The two findings proposed by both scanners (`withFragment` empty-hash, `parseAuth` colon truncation) collapsed into single findings with `**Proposed by:** Muse Spark + Muse Wonder`.

## Reading

- **Recall on this repository went from 4 to 10 published findings at 0 false positives.** All ten were verified by the model that did not propose them, so the trust contract is unchanged: every published finding still carries a machine-checked citation, an adversarial confirmation and (where executable) an execution proof.
- **The price is the second scan, and it is not cheap:** Wonder spent 10x the Spark scan and about 65% of the whole single-scanner run; dual-scan cost 3x the single run. This is why the mode is opt-in and per-scanner costs are recorded.
- **Cross-verification is what makes it defensible:** a second producer alone would have added six unverified claims; instead each Wonder-only finding was checked by Spark, which shares no role with the proposer on that finding.
- The earlier model-ablation run on the same repository had already shown that Spark as a verifier confirms all seven Wonder findings; this run turns that observation into a working publishing path.

## Caveats

- One run, one repository, n = 1. Model output is not bit-deterministic: the single-scanner run proposed 4 candidates, the dual run's Spark pass proposed 4 as well, but earlier runs of the same code produced 3 and 6.
- Both models are from the same vendor family: cross-verification is independent by role and by model instance, not by provenance.
- L3 could not run on this target (TypeScript with extensionless internal imports), so none of the ten findings is execution-proven. On a runnable target the execution proof would apply to the cross-verified findings as well.
- Duplicate detection is heuristic (same file + overlapping cited lines). It collapsed the two overlapping candidates; two citations of the same defect that do not overlap would stay as two findings.

Artifacts: `ufo/ced2e69aa61578a4/` (`run.json` with per-scanner entries, `findings.json` with `proposedBy`, `REPORT.md` with `**Proposed by:**`, `candidates.json` with the full audit).