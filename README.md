# CodeProof

**Every finding carries the level of proof it earned: machine-checked citation, adversarial confirmation, or a failing test.**

A finding appears in the main report only if the gates pass:

1. **L1 - deterministic citation gate.** The cited file, line range and verbatim snippet exist in the analyzed commit. Checked by code, not by a prompt.
2. **L2 - adversarial verifier.** A different model (Muse Wonder) tries to refute the finding. A strong refutation must carry its own machine-checked counter-citation.
3. **L3 - execution proof.** For every confirmed finding, the verifier model writes a small standalone test. The test must fail 3/3 on the analyzed commit inside a permission-model sandbox (no network, no writes, 2 s timeout) before the finding is labelled `execution-proven`.

Candidates that fail L0 or L1, receive a weak refutation, remain uncertain, or are skipped for budget are recorded in `rejected.md`. Strong refutations are recorded there with their counter-citations.

L1 is a provenance check, not a semantic judge: it checks every cited snippet against the analyzed commit. L2 is a model judgment, not a proof that the claimed defect exists. A finding is `verified` when L1 and L2 pass; it is additionally **execution-proven** only when the generated reproducer fails on the analyzed commit. None of these levels is a semantic guarantee.

## Evidence levels

| Level | Meaning | Availability |
|---|---|---|
| `citation-proven` | L1 checks every cited line against the analyzed commit. | Current |
| `adversarially-confirmed` | L2 did not refute the claim; this is a model judgment. | Current; `verified` combines this with `citation-proven` |
| `execution-proven` | L3: the verifier model wrote a test that fails 3/3 on the analyzed commit inside a sandboxed runner. | Current when a faithful executable test can be written; otherwise the finding stays at `citation-proven + adversarially-confirmed` |
| `refuted` | The verifier supplied a counter-citation that passed the current mechanical policy. | Current; semantic relevance is not guaranteed |
| `unresolved` | Weak refutation, uncertainty, failed citation or budget skip; not verified. | Current; see `rejected.md` |

## The problem

An AI review tool can produce a convincing but wrong claim even when it cites real lines. The developer then has to check both the provenance of the citation and the interpretation of the code. A tool can also miss an existing bug.

CodeProof statically reviews a TypeScript/JavaScript repository. L1 checks all citations against the analyzed commit; Muse Wonder then judges the claim in an adversarial role. `Verified` means L1 and L2 passed. The gates do not guarantee completeness or semantic accuracy: on the calibration set the current run is 8/8 with all nine published findings execution-proven, and on nine known fixes the earlier gate found two. Zero false findings were recorded among the committed, hand-checked runs; the uncommitted swr-87cf235d run listed in historical results has three verified findings without committed adjudication.

Tagline: Every finding carries the level of proof it earned: machine-checked citation, adversarial confirmation, or a failing test.

Built during the **Meta Global AI Developer Hackathon** (Oct 26 - Nov 4, 2026). Track: **Indie Developer**; theme: **Push the Frontier** (software engineering and developer tooling).

## Status

The pipeline runs end-to-end on the mock adapter (`make demo`) and live against the Meta Model API (`mode: smoke`), and the deterministic suite is green on Node 22 and Node 26:

- **Deterministic tests** (`make test`): **125/125** on Node 22 and Node 26 - L1/L2 gate cases (strict every-citation rule, exact snippet-range length), L3 cases (reproducer must import repository code that exists in the snapshot, forbidden output constructs, assertion failure, pass, timeout, network blocked, permission-model read denial, determinism), dirty-JSON and truncation handling, fault injection, config-hash determinism.
- **Clean clone**: `make clean-clone` (tmpfs + `env -i`) and the Docker variant `make clean-clone-docker` (node:22-alpine) pass `make test`, `make demo`, `make replay` and `make score RUN=reports/golden` on a fresh clone.
- **Replay**: `make replay` re-runs L0/L1 over the committed golden artifacts with no model calls - **9/9 identical, 0 mismatches**.
- **Calibration benchmark with L3**: **8/8** recall (100%), 100% precision, 0/4 traps, 0 false refutations, **9/9 published findings execution-proven** - golden run and its generated reproducers are committed verbatim in [reports/golden/](reports/golden/) (n = 8, calibration set); see [Benchmark results](#benchmark-results).
- **Real repositories** (qualitative, each hand-checked and published with both runs): unjs/ofetch, sindresorhus/execa, preactjs/preact, moment/luxon - see [Real-repository run](#real-repository-run-qualitative). The real-API probe round (axios real + injected, fastify, prompt-cache TTL, safety, parallel calls) is under [reports/probes/](reports/probes/).
- **Controlled verifier test**: two true findings confirmed and one deliberately false claim **refuted with a machine-checked counter-citation** (`src/batch.js:6`, verbatim `throw error;`); the committed run cost **$0.103** and served 3280 of 4065 input tokens from prompt cache. Recorded as `mode: controlled-verifier`, never as scanner output.
- **Historical recall**: 2/9 known fixes found (both verified); one of the organic refutations is published in the record.

Numbers are only published when measured - `run.json` says `measured: false` when they are not. Every evidence directory keeps its raw run artifacts.

## How it works

ingest -> scan -> verify -> repro -> publish

| Phase | What it does |
|---|---|
| ingest | fixes the file list from the commit (git-tracked files only; walking fallback for non-git targets), LOC and a sha256 manifest; builds a regex import graph and detects cycles |
| scan | the producer model (Muse Spark) returns findings as schema-constrained JSON: one claim, one verbatim citation, no speculation |
| verify | deterministic L1 citation check; then Muse Wonder tries to refute inside a bounded, relevant-file context (strong refute needs a machine-checked counter-citation) |
| repro | for each confirmed finding, Muse Wonder writes a standalone `node:assert` test; it runs on a `git archive` snapshot of the analyzed commit in a permission-model sandbox (no network, no writes outside the snapshot, 2 s timeout, three runs); the finding is execution-proven only if the test fails 3/3 with an assertion error |
| publish | `REPORT.md` (evidence level per finding, generated test and runner output for execution-proven findings), `findings.json` (status and reproducer result per finding), `rejected.md` (all rejected and unresolved candidates), `run.json` (models, tokens, cache hits, cost, duration, commit, repro counts) |

Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 executes only the generated test, on a snapshot, inside the sandbox described above; that isolation is process-level, not OS-level. Nothing is written to the analyzed repository.

## Meta AI tooling used

- **Two models in one gate:** Muse Spark 1.3 as producer, Muse Wonder as adversarial verifier - not one model grading itself.
- **Schema-constrained decoding** (`response_format: json_schema`): the scanner cannot emit output that violates the schema, so L0 is structural instead of best-effort parsing.
- **Prompt caching:** the repository digest is a stable prefix; cached input tokens are read from `usage.prompt_tokens_details.cached_tokens` and written to `run.json`.
- **Bounded verifier context:** the verifier sees the cited file, its import neighbours and identifier-matched files, capped at 24,000 characters; the digest and the cap are recorded per run so cost stays measurable.
- **1M-token context** on both models: the analyzed repositories so far fit in a single pass without chunking; context size and token usage are measured per run.
- **L3 reproducer as a third model role:** Muse Wonder writes the test, a deterministic runner executes it; the model output is treated as untrusted code (schema validation before execution, forbidden constructs rejected, sandboxed run). A test that cannot be written faithfully (network, DOM, missing external dependency) yields `repro-unavailable`, not a dropped finding.

## Quick start

```bash
make demo        # deterministic end-to-end demo, mock adapter, no network
make test        # L1/L2 gate, L3 runner, dirty JSON, fault injection, config hash (Node >= 22)
make controlled  # controlled verifier test: injected candidates, real API (needs MODEL_API_KEY)
make bench       # scored benchmark: bench/seed-repo, MAX_FINDINGS=12, mode bench (needs MODEL_API_KEY); REPRO=0 disables L3
make score       # score the newest benchmark run; RUN=reports/<id> selects one explicitly
make replay      # re-run L0/L1 over the committed golden artifacts (no model calls)
make clean-clone # fresh clone in tmpfs with env -i, make test/demo/score
make clean-clone-docker # same inside node:22-alpine (needs Docker)
make probe-repo ARGS="--repo <url> --commit <sha> --scope <dir> --runs 2 --dry-run"
```

`make demo` prints a **MOCK MODE** banner and writes `mock: true` into `run.json`; the analyzed fixture is synthetic and checked in on purpose. A real run needs a key (never committed):

```bash
export MODEL_API_KEY=...
node src/cli.mjs analyze /path/to/repo
```

## Controlled verifier test

`make controlled` injects a small candidate set (two true findings and one false claim that cites real lines) directly into the verifier, bypassing the scanner. That is how the project proves that a strong refutation really carries a machine-checked counter-citation without waiting for the scanner to produce a false positive on its own. The run is recorded as `mode: controlled-verifier` and every report says so; it is never presented as scanner output. These results are not benchmark recall or precision.

The committed artifacts for the controlled test are in [reports/controlled-verifier/](reports/controlled-verifier/): `run.json`, `REPORT.md`, `findings.json` and `rejected.md`. The refuted candidate in `rejected.md` carries the machine-checked counter-citation `src/batch.js:6` (verbatim `throw error;`), together with its L1 check result.

## Evidence index

| Evidence | Artifact | What it shows | What it does not show |
|---|---|---|---|
| Calibration benchmark (n=8) | [reports/golden/](reports/golden/) | 8/8 recall, 100% precision, 0/4 traps published, 9/9 published findings execution-proven | a statistical claim; the set was used for calibration |
| Real repository (unjs/ofetch) | [reports/real-world/ofetch/](reports/real-world/ofetch/) | 4/4 verified, all four match open upstream issues/PRs | novel discovery - the commit and issues are public |
| Real repository (unjs/ofetch) with L3 | [reports/real-world/ofetch/l3/](reports/real-world/ofetch/l3/) | one finding **execution-proven**: generated test reproduces the `isJSONSerializable(null)` TypeError on the analyzed commit (matches upstream issue #571) | one repository, n = 2 runs; the commit and issue are public |
| Real-repository probe round with L3 (4 repos) | [reports/real-world/probes-27-10/](reports/real-world/probes-27-10/) | defu, p-queue, zustand, yup: 7 candidates, 6 published (4 hand-confirmed), no false positives; L3 reported `repro-unavailable` on the TypeScript trees | not a benchmark; one run per repository, n = 4 |
| Real repository (sindresorhus/execa) | [reports/real-world/execa-lib/](reports/real-world/execa-lib/) | 1 verified finding in run 2 (0 in run 1): Windows shebang parser drops interpreter arguments; hand-checked | a hit-rate claim; 2 runs, public commit, the Windows path was not executed |
| Real repository (preactjs/preact) | [reports/real-world/preact-src/](reports/real-world/preact-src/) | 1 verified (refQueue not rolled back on a diff error) + 2 uncertain in run 2; 0 in run 1 | a hit-rate claim; static adjudication, error-boundary path only |
| Real repository (moment/luxon) | [reports/real-world/luxon-src/](reports/real-world/luxon-src/) | 1 verified in both runs (latent internal `uncomputeOrdinal` defect; public dates correct) + 1 organic refuted claim in run 2 | a hit-rate claim; the verified finding is latent, static + public-API adjudication |
| Real-API probe round: axios (real + injected) | [reports/probes/real/axios-lib/](reports/probes/real/axios-lib/), [reports/probes/real/axios-injected/](reports/probes/real/axios-injected/) | clean: 0 then 1 verified (an upstream revert regression); injected: 3/6 controlled defects in both runs, L1 100% | not a benchmark metric; the 6 defects were injected for this probe |
| Real-API probe round: fastify | [reports/probes/real/fastify-lib/](reports/probes/real/fastify-lib/) | 3/3 verified; hand check: F-001 confirmed, F-002/F-003 partially confirmed at lower severity | not a benchmark metric; static adjudication for F-002/F-003 |
| Safety / prompt-cache TTL / parallel probes | [reports/probes/](reports/probes/) | no content_filter on inert payloads; cache served at +2/+5/+10 min; 6/6 small parallel calls OK, shared prefix cache on 2/3 | single-run probes; no completeness or stability claim |
| Controlled verifier | [reports/controlled-verifier/](reports/controlled-verifier/) | a strong refutation carries a machine-checked counter-citation | a scanner output - candidates are injected |
| Historical recall (n=9) | [reports/historical/](reports/historical/) | 2/9 known fixes found; 7 known fixes missed | a benchmark metric; n=9, single directory per test |

`run.json` keeps the local path of the analyzed checkout; it is provenance, not required for reproduction.

## Benchmark results

Scored on the **calibration set**: frozen synthetic fixture with 8 injected defects, 4 traps and 2 pre-registered extra defects - 15 files / 229 LOC. Artifacts of the current run are committed verbatim in [reports/golden/](reports/golden/) (`run.json`, `findings.json`, `REPORT.md`, `rejected.md`, and `repro/<findingId>/` with every generated test and its runner result).

| Metric | Current (strict L1 + L3, golden `de7a1ccf`) | Previous run (`231fc717`, no L3) | Threshold |
|---|---|---|---|
| End-to-end recall (verified) | **8/8 (100%)** | 7/8 (87.5%) | >= 6/8 |
| Precision (verified-only) | **100%** (8 TP, 0 FP) | 100% (7 TP, 0 FP) | >= 90% |
| Traps published as verified | **0/4** | 0/4 | 0/4 |
| False refutations | **0** | 0 | <= 1 |
| Findings execution-proven (L3) | **9/9 published** | not run | reported |
| Candidates rejected at L1 | **0** | 1 | reported |
| Cost / duration | **$0.6204** / 168.8 s | $0.2947 / 98.8 s | measured |
| Prompt cache | 3,580 of 25,322 input tokens | 2,000 of 18,974 | reported |
| Verifier context | bounded to 24,000 characters | bounded to 24,000 characters | - |
| Scanner / verifier prompts | v3 / v1 (neutral examples) | v3 / v1 | - |
| Reproducer model | `muse-wonder-1.0`, 3 runs x 2 s timeout | - | - |

Every published finding in this run has an execution proof: the model wrote a test, the test failed 3/3 on the analyzed commit with an assertion error that matches the claim, and the test and its output are committed under [reports/golden/repro/](reports/golden/repro/). The scanner found all nine candidates this time; model output is not bit-identical, so the earlier 7/8 run (one candidate rejected at L1) is kept in the history and in [reports/golden/README.md](reports/golden/README.md).

**Attempts (no cherry-picking):** eight benchmark attempts. (1) invalidated: ingest included `dist/` build artifacts, fixed in `b0e6568`; (2) valid baseline: 7/8; (3) aborted: scanner output truncated at the token limit, tooling fixed in `d0cde39`; (4) valid post-calibration run: 8/8; (5) F4 validation run before the configuration hash fix: 8/8; (6) F4 final run: 8/8 (previous gate); (7) strict-L1 run: 7/8; (8) strict-L1 + L3 run: 8/8 with 9/9 execution-proven, shown above. Model output is not bit-identical, so the number of attempts is always stated.

This is a calibration set: prompts are tuned on the same fixture, so the numbers are **post-calibration** and n = 8 is not a statistical claim. L3 was also measured on the held-out set below and on one real repository (ofetch, see [Real-repository execution proof](#real-repository-execution-proof-qualitative)).

## Held-out generalization (qualitative)

A separate small fixture in [bench/held-out/](bench/held-out/) contains **6 defects and 4 traps** that look suspicious but are correct. It was written **after** the scanner prompt was frozen and was never used for tuning. `make ablation` pushes one candidate set through four gate levels.

| Configuration | Published | True positives | False positives | Trap leaks | Recall | Precision |
|---|---:|---:|---:|---:|---:|---:|
| scanner only | 5 | 5 | 0 | 0 | 0.833 | 1 |
| + L1 | 5 | 5 | 0 | 0 | 0.833 | 1 |
| + L1 + L2 | 5 | 5 | 0 | 0 | 0.833 | 1 |
| + L1 + L2 + L3 | 5 | 5 | 0 | 0 | 0.833 | 1 |

- **5/6 held-out defects found**; all 5 are **execution-proven** (generated test fails 3/3 with a matching assertion). The missing defect is an async retry that silently returns `undefined` - the scanner did not propose it in this run.
- **No trap was published and no false positive appeared**, so the gates did not change the published set on this run; that is a precision result, not evidence that the gates are redundant.
- **Scanner variance:** an earlier scan of the same fixture (before the fixture was committed, so L1 could not read the commit) proposed all 6 defects; the measured run proposed 5. One run is reported; n = 6 is small.
- Measured cost of the measured run: **$0.2779**, 78.2 s. Artifacts: [reports/ablations/held-out-dde34bc/](reports/ablations/held-out-dde34bc/) (`ABLATION.md`, `ablation.json` with every candidate's L1/L2/L3 outcome).
- This is **not a benchmark metric** and is not used for any headline number.

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
- This is an **anecdote, not a benchmark metric**. The analyzed commit is public and the upstream issues/PRs predate the analysis, so a model may have seen them; the run shows that the gate surfaces real, acknowledged problems - not that the findings are novel discoveries. The hand check also corrected the scanner's severity: the `withBase` issue is SSRF class upstream even though the scanner labelled it medium.

### Additional real-repository runs (execa, preact, luxon)

Three more real repositories were run with the same protocol (2 runs per frozen commit, scope fully inside the scanner prompt, hand check of every published finding; artifacts committed verbatim under [reports/real-world/](reports/real-world/)):

- [sindresorhus/execa](https://github.com/sindresorhus/execa) `lib/` (8,227 LOC): run 1 proposed nothing, run 2 verified one Windows-only shebang parser defect (`split(' ', 2)` drops interpreter arguments and returns a space-containing interpreter path). Hand verdict: confirmed, undocumented, no matching upstream issue; Windows path not executed here.
- [preactjs/preact](https://github.com/preactjs/preact) `src/` (6,214 LOC): run 1 proposed nothing, run 2 verified one error-path defect (`refQueue` is not rolled back when `diff()` throws, while `commitQueue` is) and left two candidates uncertain. Hand verdict: confirmed plausible defect (static), error-boundary path, no matching upstream issue.
- [moment/luxon](https://github.com/moment/luxon) `src/` (8,582 LOC): both runs verified the same internal `uncomputeOrdinal` conversion defect (`findIndex` instead of `findLastIndex`), but 731 ordinal and 468 ISO-week public-API cases all returned correct dates, so the verified finding is latent (hand severity low, scanner said critical); run 2 additionally **refuted** a plausible-looking locale-week claim with a machine-checked counter-citation (organic L2 evidence).
- All three are anecdotes, not benchmark metrics; the commits are public (contamination possible) and every directory includes the full runs, not only the successful one.
- **Gate version caveat:** the real-repository, probe and historical runs above were produced with the previous (looser) L1 policy. Under the strict L1 they could reject some citations on re-run; they were not re-run, and they are reported exactly as produced.

The real-API probe round (axios real/injected, fastify, TTL cache, safety, parallel) is committed under [reports/probes/](reports/probes/) with the full protocol and caveats in [REAL-WORLD-ROUND.md](reports/probes/REAL-WORLD-ROUND.md); it is separate from the benchmark and from the four hand-checked repositories above.

## Real-repository execution proof (qualitative)

Two runs of the full pipeline **with L3 enabled** on [unjs/ofetch](https://github.com/unjs/ofetch) at commit `1dbc37f` (19 files / 1,470 LOC) are in [reports/real-world/ofetch/l3/](reports/real-world/ofetch/l3/).

- **Finding (execution-proven):** `isJSONSerializable` compares `typeof value` (a string) to `null`, so `null` falls through to `value.buffer` and throws `TypeError`. The model wrote a test that calls `isJSONSerializable(null)`, catches the thrown error, and asserts it did not throw; the test fails 3/3 with `AssertionError: ... got: TypeError: Cannot read properties of null (reading 'buffer')` on the analyzed commit. The test is committed with its runner output.
- Same defect as upstream [issue #571](https://github.com/unjs/ofetch/issues/571) (fixed in PRs #572/#636); the model may have seen the public issue, so this is evidence that the gate proves real acknowledged defects by execution, not a novel-discovery claim.
- A second verified finding (retry/`AbortSignal`) stayed `inconclusive`: a faithful test needs `fetch`, which the sandbox forbids. That is the intended `repro-unavailable` path, not a failed claim.
- The first run produced a test that triggered the same `TypeError` as an uncaught runtime error and was correctly reported as `inconclusive`; the prompt now asks the model to convert a thrown error into an assertion failure, which made the proof explicit. Both runs are committed. Cost: $0.1634 + $0.4239; n = 2 runs, one repository.

## Historical recall test (qualitative)

A different question than precision: can the gate find a **known bug** if we replay history? For 9 known fix commits in two mature libraries (vercel/swr, sindresorhus/ky), the analyzed commit is the **parent of the fix** and the scope is the directory of the file the fix changes. Artifacts and per-test costs: [reports/historical/](reports/historical/).

- **2 of 9 found** (both verified); the other 7 were missed. Both hits match the lines the upstream fix changed.
- swr `c39d701` (cache unsubscribe splice, parent `46f3954`): finding `cache.ts:51-60`, verified; the fix adds an index guard exactly there. Artifacts + fix diff: [reports/historical/swr-c39d701/](reports/historical/swr-c39d701/).
- swr `9e8b1c9d` (stale subscription cleanup, parent `a33fba7`): finding `index.ts:81`, verified; the fix adds `subscriptions.delete`/`disposers.delete` in the cleanup block. Manual adjudication because the citation line is a few lines above the fix. Artifacts: [reports/historical/swr-9e8b1c9d/](reports/historical/swr-9e8b1c9d/).
- One miss run (swr f8647706) is published with its artifacts: it contains one of the two organic refutations in the public record (partially refuted - see HAND-CHECK.md); the other is the luxon run-2 refutation and one uncertain candidate caused by verifier output truncation.
- Measured cost: **$1.5223** for the 9 tests ([RESULTS.json](reports/historical/RESULTS.json)).
- Caveats: the commits and fixes are public and predate the analysis, so contamination is possible; n = 9 is small; no prompt tuning was done for these tests; this is an **anecdote, not a benchmark metric**.

## What was built during the hackathon

This repository is created during the hackathon; the first commit is tagged `hackathon-start`. All code, prompts and fixtures in this repository were authored during the event, and the git history is the evidence: every commit after the tag is event-time work, and no code or fixture from outside this repository was imported.

## Limits

- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- No completeness claim: the report shows what passed the gate, not everything that exists in a repository.
- L1 proves that every citation exists in the commit and matches the declared line range. Whether the claim matches the code is judged by the verifier model and is presented as such.
- TypeScript/JavaScript only. Scan and verify are static; L3 executes only the generated test in a sandboxed Node process. The test must import the analyzed repository code and the import must resolve inside the committed snapshot - a self-contained test is rejected at L0.
- **L3 caveats:** isolation is process-level (Node permission model + network guard + 2 s timeout), not OS-level. TypeScript is executed through Node's built-in type stripping, so a repository that needs its own build step, external dependencies or extensionless internal imports yields `repro-unavailable` - and most TypeScript source trees do use extensionless imports. L3 has been measured on the calibration fixture and on ofetch (explicit extensions); on the four-repository probe round it was correctly reported as unavailable rather than faked. A failing test proves that a concrete input misbehaves on the analyzed commit; combined with the claim it is evidence, not a semantic proof of every consequence.
- Hand checks may downgrade the scanner's severity (for example a latent internal defect or an error-path-only issue); such findings are labelled as latent/partial in the corresponding HAND-CHECK.md. Real-repository findings are qualitative anecdotes, never benchmark metrics.

## License

MIT (see [LICENSE](LICENSE)). Source snippets quoted from analyzed repositories keep their original license; each report links the analyzed repository and commit.
