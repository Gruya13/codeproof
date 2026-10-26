# Real-repository run - hand check

- Repository: [unjs/ofetch](https://github.com/unjs/ofetch) at commit `1dbc37f` (2026-07-08)
- Scope: `src/` only - 7 files, 802 LOC (ingest uses git-tracked files)
- Run: `e02cc2e908e2078a`, mode `smoke`, scanner `muse-spark-1.3-contributor`, verifier `muse-wonder-1.0`, verifier context bounded to 24,000 characters
- Gate result: 4 proposed, **4 verified** (L1 passed + Muse Wonder confirmed), 0 refuted or uncertain
- Measured: 280.8 s, **$0.5596**, 53,398 input / 39,573 output tokens, 2,500 cached input tokens. The scanner hit its 10,000-token cap once and the pipeline retried with 20,000 (see attempts below); the default budget is now 16,000.

What "verified" means here: L1 proved that every citation exists verbatim in the analyzed commit, and the verifier confirmed the claim. The table below is the **human** check of whether the claim is actually a defect and whether upstream already knows about it.

| Our finding | Hand verdict | Upstream evidence |
|---|---|---|
| F-001 - isJSONSerializable mishandles null | True in code: `t === null` can never match (t is a string from typeof), and `value.buffer` throws on null. Latent/internal defect - not reachable through the public API today because the body is truthiness-guarded first. | [issue #571](https://github.com/unjs/ofetch/issues/571), fix PRs [#572](https://github.com/unjs/ofetch/pull/572), [#636](https://github.com/unjs/ofetch/pull/636) (open) |
| F-002 - timeout retry reuses an already-aborted AbortSignal | True and user-visible: the timeout `AbortSignal` is created once before `fetch` and travels with the options object into retries; once the first attempt times out, later attempts are aborted immediately, so `retry` and `timeout` do not work together. | [issue #637](https://github.com/unjs/ofetch/issues/637), fix PRs [#638](https://github.com/unjs/ofetch/pull/638), [#621](https://github.com/unjs/ofetch/pull/621), [#640](https://github.com/unjs/ofetch/pull/640) (open) |
| F-003 - withBase prefix check lacks a path boundary | True and user-reachable: `withBase("/apiary", "/api")` returns `/apiary`; `withBase("http://api.internal.attacker.com/x", "http://api.internal")` bypasses baseURL enforcement. | [issue #564](https://github.com/unjs/ofetch/issues/564) (SSRF / authority override, CWE-918), fix PR [#576](https://github.com/unjs/ofetch/pull/576) (open) |
| F-004 - withQuery appends arrays without deleting existing values | True: `withQuery("...?tag=old", { tag: ["a", "b"] })` yields `tag=old&tag=a&tag=b`, while scalar values use `set` and replace. | fix PR [#594](https://github.com/unjs/ofetch/pull/594) (open) |

**Attempts on this repository (no cherry-picking):** three runs on the same commit and scope. Run 1 (before the bounded verifier context) found 4/4 verified for $0.2928; run 2 (after the context builder) found 3/3 for $0.1991; run 3 (shown here) found 4/4 for $0.5596 because the scanner hit its token cap and retried. Model output is not bit-identical; the artifacts committed here are the latest valid run, and the earlier results are stated above.

**Honest caveat:** the analyzed commit is public and the upstream issues/PRs above were opened before this analysis, so a model may have seen them. This run is a demonstration that the pipeline surfaces real, acknowledged problems on real code - **not** a claim of independent discovery - and it is a qualitative anecdote, not part of the benchmark metrics. Scanner severities are model-assigned; the hand verdict above adjusts the impact class (F-003 is an SSRF-class issue upstream even though the scanner labelled it medium).

Files: `run.json` (models, tokens, cache, cost, commit, budget), `findings.json` (status, L1 and verifier verdicts), `REPORT.md`, `rejected.md`.
