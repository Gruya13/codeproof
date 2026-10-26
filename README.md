# CodeProof

**AI review that publishes only what it can prove.**

A finding appears in the main report only if two independent gates pass:

1. **L1 - deterministic citation gate.** The cited file, line range and verbatim snippet exist in the analyzed commit. Checked by code, not by a prompt.
2. **L2 - adversarial verifier.** A different model (Muse Wonder) tries to refute the finding. A strong refutation must carry its own machine-checked counter-citation.

Everything that fails the gate is still published - in `rejected.md`, with the evidence that refuted it. The claim is not "we found everything". It is "we do not publish what we could not prove".

Built during the **Meta Global AI Developer Hackathon** (Oct 26 - Nov 4, 2026), Indie Developer track.

## Status

Milestone F1 is complete: the pipeline runs end-to-end on the mock adapter (`make demo`) and live against the Meta Model API (`mode: smoke`). First live runs on the 4-file demo fixture: 2 calls (Muse Spark 1.3 producer, Muse Wonder verifier), 1 finding passed both gates, 16.5 s wall time, **$0.0335 measured cost**; a second run measured **229 of 1365 input tokens served from prompt cache**. Numbers are only published when measured - `run.json` says `measured: false` when they are not. The first scored benchmark run is in [Benchmark results](#benchmark-results); its artifacts are committed verbatim in [reports/golden/](reports/golden/). A qualitative run on a real open-source project is in [Real-repository run](#real-repository-run-qualitative).

A controlled verifier test (`make controlled`) closed the hard gate on the real API: two true findings were confirmed and one deliberately false claim was **refuted with a machine-checked counter-citation** (`src/batch.js:6`, verbatim `throw error;`). The run cost **$0.103** and served **3280 of 4065 input tokens from prompt cache**. It is recorded as `mode: controlled-verifier` and labelled as injected candidates in every report - never as scanner output.

## How it works

ingest -> scan -> verify -> publish

| Phase | What it does |
|---|---|
| ingest | fixes the file list from the commit (git-tracked files only; walking fallback for non-git targets), LOC and a sha256 manifest; builds a regex import graph and detects cycles |
| scan | the producer model (Muse Spark) returns findings as schema-constrained JSON: one claim, one verbatim citation, no speculation |
| verify | deterministic L1 citation check; then Muse Wonder tries to refute inside a bounded, relevant-file context (strong refute needs a machine-checked counter-citation) |
| publish | `REPORT.md`, `findings.json` (status per finding), `rejected.md`, `run.json` (models, tokens, cache hits, cost, duration, commit) |

Static analysis only: the analyzed code is never executed, patched, or sent anywhere except the Meta Model API.

## Meta AI tooling used

- **Two models in one gate:** Muse Spark 1.3 as producer, Muse Wonder as adversarial verifier - not one model grading itself.
- **Schema-constrained decoding** (`response_format: json_schema`): the scanner cannot emit output that violates the schema, so L0 is structural instead of best-effort parsing.
- **Prompt caching:** the repository digest is a stable prefix; cached input tokens are read from `usage.prompt_tokens_details.cached_tokens` and written to `run.json`.
- **Bounded verifier context:** the verifier sees the cited file, its import neighbours and identifier-matched files, capped at 24,000 characters; the digest and the cap are recorded per run so cost stays measurable.
- **1M-token context** on both models: the analyzed repositories so far fit in a single pass without chunking; context size and token usage are measured per run.

## Quick start

```bash
make demo        # deterministic end-to-end demo, mock adapter, no network
make test        # unit tests for the L1 gate, dirty-JSON parsing and run-id
make controlled  # controlled verifier test: injected candidates, real API (needs MODEL_API_KEY)
make bench       # scored benchmark: bench/seed-repo, MAX_FINDINGS=12, mode bench (needs MODEL_API_KEY)
make score       # score the newest benchmark run; RUN=reports/<id> selects one explicitly
```

`make demo` prints a **MOCK MODE** banner and writes `mock: true` into `run.json`; the analyzed fixture is synthetic and checked in on purpose. A real run needs a key (never committed):

```bash
export MODEL_API_KEY=...
node src/cli.mjs analyze /path/to/repo
```

## Controlled verifier test

`make controlled` injects a small candidate set (two true findings and one false claim that cites real lines) directly into the verifier, bypassing the scanner. That is how the project proves that a strong refutation really carries a machine-checked counter-citation without waiting for the scanner to produce a false positive on its own. The run is recorded as `mode: controlled-verifier` and every report says so; it is never presented as scanner output. These results are not benchmark recall or precision.

## Benchmark results

Scored on the **calibration set**: frozen synthetic fixture with 8 injected defects, 4 traps and 2 pre-registered extra defects - 15 files / 229 LOC. Artifacts of the current run are committed verbatim in [reports/golden/](reports/golden/) (`run.json`, `findings.json`, `REPORT.md`, `rejected.md`).

| Metric | Current (F4, golden) | Pre-calibration baseline | Threshold |
|---|---|---|---|
| End-to-end recall (verified) | **8/8 (100%)** | 7/8 (87.5%) | >= 6/8 |
| Precision (verified-only) | **100%** (8 TP, 0 FP) | 100% (7 TP, 0 FP) | >= 90% |
| Traps published as verified | **0/4** | 0/4 | 0/4 |
| False refutations | **0** | 0 | <= 1 |
| Cost / duration | **$0.2190** / 101.4 s | $0.2308 / 93.2 s | measured |
| Prompt cache | 6,801 of 20,873 input tokens | 4,000 of 26,255 | reported |
| Verifier context | bounded to 24,000 characters (F4) | whole repository | - |
| Scanner prompt version | v3 | v2 | - |

The bounded verifier context cut benchmark input tokens from 29,408 to 20,873 (**-29%**) with identical metrics; observed cost fell from $0.2777 to $0.2190 on the compared attempts. The baseline missed B-05 (a timer handle replaced without clearing the previous interval); scanner prompt v3 adds generic audits for leaked resource handles and repeated-call accumulators, after which the frozen fixture was re-scanned and B-05 was found. One pre-registered extra defect (X-02, numeric sort without comparator) is found and correctly counted as neither TP nor FP; no trap was proposed by the scanner in any run, so the refutation path is demonstrated separately by the controlled verifier test.

**Attempts (no cherry-picking):** six benchmark attempts. (1) invalidated: ingest included `dist/` build artifacts, fixed in `b0e6568`; (2) valid baseline: 7/8; (3) aborted: scanner output truncated at the token limit, tooling fixed in `d0cde39`; (4) valid post-calibration run: 8/8; (5) F4 validation run before the configuration hash fix: 8/8; (6) F4 final run: 8/8, shown above. Model output is not bit-identical, so the number of attempts is always stated.

This is a calibration set: prompts are tuned on the same fixture, so the numbers are **post-calibration** and n = 8 is not a statistical claim. The pre-calibration baseline is shown for transparency.

## Real-repository run (qualitative)

The pipeline was also run on a real, widely used open-source project: [unjs/ofetch](https://github.com/unjs/ofetch) at commit `1dbc37f`, scope `src/` (7 files, 802 LOC). Run artifacts and the human review are committed in [reports/real-world/ofetch/](reports/real-world/ofetch/).

- 4 findings proposed, **4 verified** by the gate (L1 passed + Muse Wonder confirmed), 0 refuted or uncertain
- 280.8 s, **$0.5596** measured (the scanner hit its token cap once and the pipeline retried with double budget; the default is now 16,000)
- Hand check (see [HAND-CHECK.md](reports/real-world/ofetch/HAND-CHECK.md)): **all four findings correspond to open upstream issues or fix PRs**:
  - `isJSONSerializable` null handling - [issue #571](https://github.com/unjs/ofetch/issues/571), PRs [#572](https://github.com/unjs/ofetch/pull/572), [#636](https://github.com/unjs/ofetch/pull/636)
  - `retry` + `timeout` incompatible because an aborted `AbortSignal` is reused - [issue #637](https://github.com/unjs/ofetch/issues/637), PRs [#638](https://github.com/unjs/ofetch/pull/638), [#621](https://github.com/unjs/ofetch/pull/621), [#640](https://github.com/unjs/ofetch/pull/640)
  - `baseURL` prefix boundary reported as SSRF (CWE-918) - [issue #564](https://github.com/unjs/ofetch/issues/564), PR [#576](https://github.com/unjs/ofetch/pull/576)
  - `withQuery` array values appended without replacing existing ones - PR [#594](https://github.com/unjs/ofetch/pull/594)
- Runs are not bit-identical: three runs on this commit and scope produced 4/4, 3/3 and 4/4 verified findings ($0.2928, $0.1991, $0.5596). The latest valid run is the one committed here; earlier results are stated above.
- This is an **anecdote, not a benchmark metric**. The analyzed commit is public and the upstream issues/PRs predate the analysis, so a model may have seen them; the run shows that the gate surfaces real, acknowledged problems - not that the findings are independent discovery. The hand check also corrected the scanner's severity: the `withBase` issue is SSRF class upstream even though the scanner labelled it medium.

## What was built during the hackathon

This repository is created during the hackathon; the first commit is tagged `hackathon-start`. All code, prompts and fixtures in this repository were authored during the event, and the git history is the evidence: every commit after the tag is event-time work, and no code or fixture from outside this repository was imported.

## Limits

- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- No completeness claim: the report shows what passed the gate, not everything that exists in a repository.
- L1 proves that a citation exists in the commit. Whether the claim matches the code is judged by the verifier model and is presented as such.
- TypeScript/JavaScript only, static analysis only.

## License

MIT (see [LICENSE](LICENSE)). Source snippets quoted from analyzed repositories keep their original license; each report links the analyzed repository and commit.
