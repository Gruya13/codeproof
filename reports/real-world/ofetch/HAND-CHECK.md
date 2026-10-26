# Real-repository run - hand check

- Repository: [unjs/ofetch](https://github.com/unjs/ofetch) at commit `1dbc37f` (2026-07-08)
- Scope: `src/` only - 7 files, 802 LOC (ingest uses git-tracked files)
- Run: `09e78bb8e4a0b6eb`, mode `smoke`, scanner `muse-spark-1.3-contributor`, verifier `muse-wonder-1.0`
- Gate result: 4 proposed, **4 verified** (L1 passed + Muse Wonder confirmed), 0 refuted, 0 uncertain
- Measured: 90.2 s, **$0.2928**, 38,529 input / 15,824 output tokens, 2,000 cached input tokens

What "verified" means here: L1 proved that every citation exists verbatim in the analyzed commit, and the verifier confirmed the claim. The table below is the **human** check of whether the claim is actually a defect, what kind, and whether upstream already knows about it.

| Our finding | Hand verdict | Upstream evidence |
|---|---|---|
| F-001 - isJSONSerializable crashes on null | True in code: `t === null` can never match (t is a string from typeof), and `value.buffer` throws on null. Not reachable through the public API today because the body is truthiness-guarded first; latent/internal defect. | [issue #571](https://github.com/unjs/ofetch/issues/571), fix PRs [#572](https://github.com/unjs/ofetch/pull/572), [#636](https://github.com/unjs/ofetch/pull/636) (open) |
| F-002 - falsy bodies are skipped by the truthiness check | True inconsistency: `body: 0`, `false` and `""` skip JSON stringification and the JSON content-type, while a non-empty string body gets `application/json`. Edge case; hand-classified low. | no upstream report found |
| F-003 - withBase prefix check lacks a path boundary | True and user-reachable: `withBase("/apiary", "/api")` returns `/apiary`; `withBase("http://api.internal.attacker.com/x", "http://api.internal")` bypasses baseURL enforcement. | [issue #564](https://github.com/unjs/ofetch/issues/564) (SSRF/authority override, CWE-918), fix PR [#576](https://github.com/unjs/ofetch/pull/576) (open) |
| F-004 - withQuery appends arrays without deleting existing values | True: `withQuery("...?tag=old", { tag: ["a", "b"] })` yields `tag=old&tag=a&tag=b`, while scalar values use `set` and replace. | fix PR [#594](https://github.com/unjs/ofetch/pull/594) (open) |

**Honest caveat:** the analyzed commit is public and the upstream issues/PRs above were opened before this analysis, so a model may have seen them. This run is a demonstration that the pipeline surfaces real, acknowledged problems on real code - **not** a claim of independent discovery - and it is a qualitative anecdote, not part of the benchmark metrics. Scanner severities are model-assigned; the hand verdict above adjusts the impact class.

Files: `run.json` (models, tokens, cache, cost, commit, budget), `findings.json` (status, L1 and verifier verdicts), `REPORT.md`, `rejected.md`.
