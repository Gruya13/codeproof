# Historical recall run - swr f8647706 (missed fix, organic refutation)

- Repository: [vercel/swr](https://github.com/vercel/swr)
- Analyzed commit: `1f93cc2c` - the **parent** of fix commit `f8647706` ("fix: Ensure preload runs only on client")
- Scope: `src/_internal/utils` (21 files, 1,020 LOC)
- Run: `a5d8f85f0577cbfa`, mode `smoke`, scanner `muse-spark-1.3` (contributor), verifier `muse-wonder-1.0`
- Cost and time: **$0.6959**, **250.5 s**; prompt cache 18,092 of 65,880 input tokens; 8 calls
- Measured: 4 proposed, 2 verified, 1 refuted, 1 uncertain, 0 rejected at L1

These four files are a **verbatim copy** of the run artifacts. The fix this test targeted (preload on the server, `f8647706`) was **missed**: no finding cites that change. The run is published because it contains the only **organic** refutation in the public record (F-004) and one uncertain candidate (F-003).

## The four findings

| ID | Status | Citation | Title |
|---|---|---|---|
| F-001 | **verified** | `cache.ts:51-60` | Unsubscribe without index check removes wrong subscriber |
| F-002 | **verified** | `helper.ts:6-6` | Module-level INITIAL_CACHE never reset shares stale snapshot |
| F-003 | uncertain | `mutate.ts:148-149` | Unconditional `_c` clear races with concurrent optimistic mutations |
| F-004 | refuted | `config-context.ts:44-51` | Late or changed provider misses init and cleanup |

## Adjudication

**F-004 (refuted): Partially refuted.** The counter-citations prove that a provider appearing after mount does get `initProvider` called during that render (`config-context.ts:45-50` calls `initCache`; `cache.ts:123` calls `initProvider` inside `initCache`), so the "never calls `initProvider`" half of F-004 is **false**. The half about a changed provider and cleanup is **not** resolved by the counter-citation. F-004 is therefore **not counted as a fully refuted claim**. Both counter-citations passed the machine check (`counterEvidenceL1.passed = true`).

**F-003 (uncertain): not published as verified.** The verifier output was not parseable (`finish_reason=length`, empty model output); the pipeline retried once with a larger budget and still could not get a verdict. `uncertain` means **for manual review only** - it is not shown as a verified finding.

**F-001 and F-002 (verified):** both passed L1 and the verifier; F-001 is the same defect class later fixed in swr `c39d701` (an older parent in this suite). They are published as verified by the same rule as in every other run.

## Caveats

- This run is part of the historical recall test (test tag `swr-f8647706`, parent `1f93cc2c`, fix `f8647706`) and is listed as a **miss** for that fix in the suite table; it is published as evidence for the organic refutation, not as a hit.
- The analyzed commit and the upstream fix are public and predate the analysis, so model contamination is possible. This is a demonstration, not independent discovery, and not a benchmark metric.
