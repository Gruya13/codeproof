# CodeProof

**Every finding carries the level of proof it earned: machine-checked citation, adversarial confirmation, or a failing test.**

A finding appears in the main report only if the gates pass:

1. **L1 - deterministic citation gate.** The cited file, line range and snippet exist in the analyzed commit (the snippet is compared after whitespace normalization; see Limits). Checked by code, not by a prompt.
2. **L2 - adversarial verifier.** A different model (Muse Wonder) tries to refute the finding. A strong refutation must carry its own machine-checked counter-citation.
3. **L3 - execution proof.** For every confirmed finding, the verifier model writes a small standalone test. The test must fail on every one of at least three runs on the analyzed commit inside a permission-model sandbox (no network, no writes, 2 s default timeout) before the finding is labelled `execution-proven`.

Candidates that fail L0 or L1, receive a weak refutation, remain uncertain, or are skipped for budget are recorded in `rejected.md`. Strong refutations are recorded there with their counter-citations.

L1 is a provenance check, not a semantic judge: it checks every cited snippet against the analyzed commit. L2 is a model judgment, not a proof that the claimed defect exists. A finding is `verified` when L1 and L2 pass; it is additionally **execution-proven** only when the generated reproducer fails on the analyzed commit. None of these levels is a semantic guarantee.

## Evidence levels

| Level | Meaning | Availability |
|---|---|---|
| `citation-proven` | L1 checks every cited line against the analyzed commit. | Current |
| `adversarially-confirmed` | L2 did not refute the claim; this is a model judgment. | Current; `verified` combines this with `citation-proven` |
| `execution-proven` | L3: the verifier model wrote a test that fails every run (at least three) on the analyzed commit inside a sandboxed runner. | Current when a faithful executable test can be written; otherwise the finding stays at `citation-proven + adversarially-confirmed` |
| `refuted` | The verifier supplied a counter-citation that passed the current mechanical policy. | Current; semantic relevance is not guaranteed |
| `unresolved` | Weak refutation, uncertainty, failed citation or budget skip; not verified. | Current; see `rejected.md` |

## Proof levels (v0.2.0)

| Level | Name | How it is earned |
|---|---|---|
| L1 | citation-proven | the cited file and lines exist in the analyzed commit and the snippet matches them after whitespace normalization |
| L2 | adversarially-confirmed | the verifier model, seeing the bounded context, failed to refute the claim (a strong refutation carries a machine-checked counter-citation) |
| L3 | execution-proven | the verifier wrote two files: a `[CONTROL]` that must pass every run (at least three) on a `git archive` snapshot, and a `[TRIGGER]` with a different input that must fail every run with an assertion error. The failure must be a real `node:assert` failure (`AssertionError [ERR_ASSERTION]`); an explicit `throw` is rejected at L0. LinkCheck then proves the imported symbol actually executed - symbol granularity, or file granularity for barrel re-exports and anonymous/default exports (recorded as `linkcheck.method`) - with inspector coverage in memory, under the Node permission model, no writes, no network. All three must hold |
| L4 | patch-proven | for an execution-proven finding, the patcher model proposes a minimal patch to one of the cited files (unique `searchBlock`, at most 25 lines, no API change); the patch is applied to a **copy** of the snapshot, and both phases must pass: control passes and trigger passes on every run after the patch |

What the chain does **not** prove is stated in Limits: the semantic tie between the failure and the claimed defect is a human review (F1.11), not a machine proof; `patch-proven` is a differential result over the reproduction, not a root-cause fix, and the repository's own test suite is never run.

L3/L4 proof is awarded on **Node 26.8.2** only, because LinkCheck needs `--allow-inspector`. On Node 22.23.3 the same run reports `link-unproven` (fail-closed) and the finding stays `verified` - that is documented behaviour, not a failure.

## The problem

An AI review tool can produce a convincing but wrong claim even when it cites real lines. The developer then has to check both the provenance of the citation and the interpretation of the code. A tool can also miss an existing bug.

CodeProof statically reviews a TypeScript/JavaScript repository. L1 checks all citations against the analyzed commit; Muse Wonder then judges the claim in an adversarial role. `Verified` means L1 and L2 passed. The gates do not guarantee completeness or semantic accuracy: on the calibration set the current run is 8/8 with all nine published findings execution-proven, and on nine known fixes the earlier gate found two. Zero false findings were recorded among the committed, hand-checked runs; the uncommitted swr-87cf235d run listed in historical results has three verified findings without committed adjudication.

Tagline: Every finding carries the level of proof it earned: machine-checked citation, adversarial confirmation, or a failing test.

Built during the **Meta Global AI Developer Hackathon** (Oct 26 - Nov 4, 2026). Track: **Indie Developer**; theme: **Push the Frontier** (software engineering and developer tooling).

## Status

The pipeline runs end-to-end on the mock adapter (`make demo`) and live against the Meta Model API (`mode: smoke`), and the deterministic suite is green on Node 22 and Node 26:

- **Deterministic tests** (`make test`): **234/234** on Node 22 and Node 26 - L1/L2 gate cases (strict every-citation rule, exact snippet-range length), commit-based ingestion (dirty working tree cannot change the analysis), L3 cases (reproducer must import and call repository code that exists in the snapshot, no non-determinism, no trivial assertions, assertion failure, pass, timeout, network blocked, permission-model read denial, determinism), agent layer (role/label/cost recording, mock and meta adapters, soft and hard budget gates), dirty-JSON and truncation handling, fault injection, config-hash determinism.
- **Clean clone**: `make clean-clone` (tmpfs + `env -i`) and the Docker variant `make clean-clone-docker` (node:22-alpine) pass `make test`, `make demo`, `make replay` and `make score RUN=reports/golden` on a fresh clone.
- **Replay**: `make replay` re-runs L0/L1 over the committed golden artifacts with no model calls - **9/9 identical, 0 mismatches**.
- **Calibration benchmark with L3**: **8/8** recall (100%), 100% precision, 0/4 traps proposed and 0/4 published, 0 false refutations, **9/9 published findings execution-proven** - automated scoring is a file + line spatial match; semantic correctness comes from the hand-checked adjudication - golden run and its generated reproducers are committed verbatim in [reports/golden/](reports/golden/) (n = 8, calibration set); see [Benchmark results](#benchmark-results).
- **v0.2.0 evidence levels**: two-phase L3 (`[CONTROL]` must pass and `[TRIGGER]` must fail on every run, at least three), LinkCheck linkage proof (the imported symbol must actually execute, inspector coverage under the permission model), L4 surgical patch with a differential proof (`patch-proven`), offline replay of v2 reports with attestation and a git anchor, a zero-dependency Proof Explorer, and an MCP server with `codeproof_scan`/`codeproof_replay`. Evidence: [reports/v0.2.0/](reports/v0.2.0/).
- **Dogfooding (v0.2.1)**: CodeProof on its own `src/` (21 files / 4,221 LOC) with the same prompt and schema. Single-pass 3 verified / 1 patch-proven ($0.90), dual 1 verified ($1.41, the secondary Wonder scan failed), **chunked 9 verified / 2 patch-proven** ($2.26). 10 unique defects published across the runs, **all 10 fixed** (the last three in commit `b41f256`, with regression tests in `tests/hardening-package-c.test.mjs`); `replay` PASS without an API key. Evidence: [reports/v0.2.0/self-analysis/](reports/v0.2.0/self-analysis/).
- **v0.2.2 fixes from the real-world sample**: the patcher retries an empty/truncated response with a doubled output budget - verified on the sample, where it recovered **three previously lost `patch-proven` proofs** (picomatch runs 4-5, jsesc run 3; $2.7680) - and the reproducer prompt states the different-input rule with a concrete example (prompt-level only: the L0 rejections in the sample remained). Regression tests: `tests/real-world-fixes.test.mjs` (5 tests, locked; suite 234/234).
- **v0.2.2 hardening (Oct 28)**: an independent analysis (codex + agy, cross-verified, test-lock watchdog OK) closed two P0 sandbox-boundary holes - an L4/replay path traversal and a LinkCheck symlink write that could escape the snapshot - plus replay fail-open (a v2 replay without a checkout no longer prints PASS), false `evidenceLevel` on non-verified findings, a verifier retry that crashed the run, a textually faked `AssertionError`, and L2 counter-citations not bound to the declared file. Regression tests: `tests/hardening-package-a.test.mjs` + `tests/hardening-package-b.test.mjs` (12 tests, locked).
- **v0.2.2 hardening, second round (Oct 28)**: the L4 patcher now receives the bounded cited-file context (it was blind to everything but the cited snippet), LinkCheck covers the cited file and every repository import (barrel re-exports and anonymous/default exports are proven at file granularity, method recorded), offline replay re-runs LinkCheck and uses at least three deterministic runs, the three remaining self-analysis ingest defects are fixed, and scan diagnostics honour `--out`. Regression tests: `tests/hardening-package-c.test.mjs` (9 tests, locked).
- **v0.2.2 hardening, third round (Oct 28)**: dual-scan dedup now requires stemmed claim similarity and compares every evidence entry; `analyze` refuses an output directory inside the analyzed repository unless `--allow-output-in-target` is passed (symlinked output paths are resolved first); an explicit commit that cannot be read in a git repository fails closed instead of falling back to the working tree. Regression tests: `tests/hardening-package-d.test.mjs` + `tests/hardening-package-e.test.mjs` (11 tests, locked).
- **Extended evaluation on real code**: a second set frozen before its first run - 16 injected defects + 5 traps in axios `lib/` (74 files / 9,564 LOC): 4-7/16 verified per single-pass run, **9-10/16 with chunked scanning** (`CHUNKED_SCAN=1`), 0/5 traps published in seven runs; see [bench/extended/](bench/extended/).
- **Real repositories** (qualitative, each hand-checked and published with both runs): unjs/ofetch, sindresorhus/execa, preactjs/preact, moment/luxon - see [Real-repository run](#real-repository-run-qualitative). The real-API probe round (axios real + injected, fastify, prompt-cache TTL, safety, parallel calls) is under [reports/probes/](reports/probes/).
- **Controlled verifier test**: two true findings confirmed and one deliberately false claim **refuted with a machine-checked counter-citation** (`src/batch.js:6`, verbatim `throw error;`); the committed run cost **$0.103** and served 3280 of 4065 input tokens from prompt cache. Recorded as `mode: controlled-verifier`, never as scanner output.
- **Historical recall**: 2/9 known fixes found (both verified); one of the organic refutations is published in the record.
- **Upstream impact (29 Oct 2026)**: three findings from the v0.2.2 sample were filed as upstream issues ([picomatch #243](https://github.com/micromatch/picomatch/issues/243), [#242](https://github.com/micromatch/picomatch/issues/242), [jsesc #79](https://github.com/mathiasbynens/jsesc/issues/79)); other contributors opened a fix PR for all three within 24 hours - all PRs are **open and unmerged** - see [Upstream impact](#upstream-impact-qualitative).

Numbers are only published when measured - `run.json` says `measured: false` when they are not. Every evidence directory keeps its raw run artifacts.

## How it works

ingest -> scan -> verify -> repro -> publish

| Phase | What it does |
|---|---|
| ingest | reads the **file list and the file contents from the analyzed commit** (`git ls-tree` + `git show`), so uncommitted changes cannot alter the analysis; LOC and a sha256 manifest; builds a regex import graph and detects cycles. Falls back to the working tree for non-git targets (mock demo) |
| scan | the producer model (Muse Spark) returns findings as schema-constrained JSON: one claim, one verbatim citation, no speculation |
| verify | deterministic L1 citation check; then Muse Wonder tries to refute inside a bounded, relevant-file context (strong refute needs a machine-checked counter-citation) |
| repro | for each confirmed finding, Muse Wonder writes a standalone `node:assert` test; it runs on a `git archive` snapshot of the analyzed commit in a permission-model sandbox (no network, no writes outside the snapshot, 2 s default timeout, at least three runs); the finding is execution-proven only if the test fails on every run (at least three) with a real `node:assert` assertion error |
| publish | `REPORT.md` (evidence level per finding, generated test and runner output for execution-proven findings), `REPORT.html` (a self-contained static copy of the same evidence: funnel, per-finding proof level, `[CONTROL]`/`[TRIGGER]` code, LinkCheck method, patch diff, rejected candidates; no JavaScript, no network), `findings.json` (status and reproducer result per finding), `rejected.md` (all rejected and unresolved candidates), `run.json` (models, tokens, cache hits, cost, duration, commit, repro counts, `outputs.html`) |

Scan and verify are static: the analyzed code is never executed while the scanner and verifier run. L3 executes only the generated test, on a snapshot, inside the sandbox described above; that isolation is process-level, not OS-level. Nothing is written to the analyzed repository.

## Dual-scanner mode (opt-in)

`DUAL_SCAN=1` turns **both Meta models into producers**: Muse Spark and Muse Wonder each scan the repository with the same prompt and schema, and their candidates are merged:

- the same file with overlapping cited lines **and** sufficiently similar claims (stemmed token overlap >= 0.5, every evidence entry compared, not only the first) = one finding, tagged with both proposers; ids are renumbered so the two scanners cannot collide (`scannerIds` keeps the originals);
- every finding records `proposedBy` in `findings.json` and shows `**Proposed by:**` in the report; `run.json` records per-scanner models, candidate counts, cost and L0 rejects;
- **cross-verification:** the verifier is the model that did *not* propose the finding - a Wonder-proposed finding is cross-examined by Spark, a Spark-proposed finding by Wonder. A finding proposed by both is verified by the default verifier. The adversarial check therefore stays in place for every candidate.

**Why it exists.** In the model-ablation run on `unjs/ufo`, Wonder alone proposed five real defects that Spark never proposed; the single-scanner pipeline could not publish them because the producer never proposed them, and Spark as a verifier confirmed all seven Wonder findings. Dual-scan closes that recall gap at a known price: the second scan is roughly one extra Wonder pass, so the mode is opt-in and `run.json` records the cost per scanner.

**Limits:** both models are from the same vendor family, so cross-verification is independent by role and model, not by provenance; duplicate detection is heuristic (file + overlapping lines + stemmed claim similarity), so two citations of the same defect that do not overlap, or that describe it in very different words, remain two findings; the hard budget gate can refuse the second scan or later verifications, and `run.json` records the abort reason. The secondary scanner (Wonder) only finishes on small targets: on 4k and 7.6k LOC it hit the output-token limit even at 48k and the retry failed, so the run degraded to the primary scanner (`scanners[].status = error`). `DUAL_SCAN_MAX_LOC=2500` skips the secondary scan above that size (`status: skipped-loc`) and avoids the wasted spend; it is off by default.

## Offline replay, Proof Explorer, MCP (v0.2.0)

```bash
make integrity                                   # baseline tree/file hashes + frozen evidence + test locks
make replay-v2 RUN=<report-dir>                  # offline v2 evidence replay (same as the CLI replay below)
node src/cli.mjs replay <report-dir> [repo-path] --anchor <rev> --out <dir>
xdg-open docs/index.html                         # Proof Explorer: opens in your browser; load run.json + findings.json (static file, no server)
node src/mcp/index.mjs                           # MCP server over stdio (codeproof_scan, codeproof_replay)
```

**Replay** re-verifies a v2 report with no model calls: it checks the attestation hash of every artifact, recomputes the config payload hash, verifies the optional git anchor (`git diff` + `status` against a revision), re-runs L1 citations, re-executes the L3 control/trigger pair and re-applies the L4 patch. The semantic L2 verdict is not re-executed - replay proves the record is unchanged and the mechanical gates still hold, not that the model's judgement was true. v1 reports replay in limited mode (L0/L1) with an explicit note.

**Proof Explorer** (`docs/index.html`, single file, no dependencies, no network) shows the evidence funnel (proposed -> L1 rejected -> verified -> execution-proven -> patch-proven) and, per finding, the `[CONTROL]`/`[TRIGGER]` code, LinkCheck status, the patch diff and the counter-citation. Historical v1 findings carry a "control not recorded (v1)" badge.

## Dogfooding - CodeProof on itself (v0.2.1)

The system was run on its own `src/` (21 files / 4,221 LOC `@ 25c2a26`) with the same scanner prompt, schema and digest, then on the same target with the opt-in dual and chunked modes, and with each model standalone. Every run is committed verbatim under [reports/v0.2.0/self-analysis/](reports/v0.2.0/self-analysis/).

| Architecture | Candidates | Verified | L1 rejected | execution-proven | patch-proven | Cost | Time |
|---|---:|---:|---:|---:|---:|---:|---:|
| Single pass | 3 | 3 | 0 | 1 | 1 | $0.8968 | 5.2 min |
| Dual scan (`DUAL_SCAN=1`) | 2 | 1 | 1 | 1 | 0 | $1.4074 | 9.3 min |
| Chunked (`CHUNKED_SCAN=1`) | 11 | 9 | 2 | 3 | 2 | $2.2573 | 14.3 min |

The dual run degraded to the primary scanner because the Wonder secondary scan returned an empty output after the truncation retry (431 s, `scanners[].status = error`) - the same known limitation as on other 4k+ LOC targets. Standalone on the same target: Spark alone proposed 4 candidates, all L1-valid, for $0.1357 (3 overlap with CodeProof, 1 new); Wonder alone returned an empty output after its retry and cost $1.2167 without a single candidate.

**Defects found on itself and fixed (commit `52e6606`):**

1. `unifiedDiff` read index `-1` when `before` was a prefix of `after`, emitting `-undefined`/`+undefined` lines in the L4 diff (the system's own patch-proof gate found it; **patch-proven**).
2. `applyPatchToSnapshot` used `String.replace` with a string replacement, so `$&`, `$1` and `$$` in a proposed patch were expanded instead of inserted literally.
3. The hard-budget estimate and the constructed agent used **different fallback models** for `scanner-secondary` (`scannerModel` vs `verifierModel`); a single `roleModel` is now the source of truth for both (**patch-proven**).
4. `usage.byRole` bucketed every non-scanner role as `verifier`, hiding patcher and secondary-scanner calls and merging their models.
5. `run.json.repro.enabled` did not include the mock pipeline, although the mock mode executes L3/L4 locally.
6. `checkCitation` crashed on an unreadable cited file instead of returning a failed citation.
7. `attemptPatch`'s `unsupported` early return skipped `durationMs`.

Evidence: `tests/self-analysis-fixes.test.mjs` (8 regression tests, two-commit test lock; the suite was **197/197** at that revision - the current suite is **234/234** on Node 22 and Node 26) and the fixes are enforced by `make integrity`.

**Offline re-verification (no API key):**

```bash
node src/cli.mjs replay reports/v0.2.0/self-analysis/a5e5c1c9868a5e4f --anchor 1e5f577 --out /tmp/replay-self
# Anchor: 1e5f577 (verified); Attestation: 11 artifacts, 0 problems
# F-001 ... L1 pass | control passed / trigger assertion-failure | patch-proven
# REPLAY PASS: every replayed check matches the recorded report
```

**All three remaining findings are fixed (commit `b41f256`):** the `from`-import scan now stops at statement boundaries, the scanner-input block separators are counted against the prompt cap, and a trailing newline no longer produces a phantom numbered line. Regression tests: `tests/hardening-package-c.test.mjs`. The historical evidence README (`reports/v0.2.0/README.md`) is left as published, including its original "remaining unfixed" note from the run that found them.

## Meta AI tooling used

- **Two models in one gate:** Muse Spark 1.3 as producer, Muse Wonder as adversarial verifier - not one model grading itself.
- **Schema-constrained decoding** (`response_format: json_schema`): the scanner cannot emit output that violates the schema, so L0 is structural instead of best-effort parsing.
- **Prompt caching:** the repository digest is a stable prefix; cached input tokens are read from `usage.prompt_tokens_details.cached_tokens` and written to `run.json`.
- **Bounded verifier context:** the verifier sees the cited file, its import neighbours and identifier-matched files, capped at 24,000 characters by default (`VERIFIER_CONTEXT_CHARS`); the digest and the cap are recorded per run so cost stays measurable.
- **1M-token context** on both models: the analyzed repositories so far fit in a single pass without chunking; context size and token usage are measured per run.
- **L3 reproducer as a third model role:** Muse Wonder writes the test, a deterministic runner executes it; the model output is treated as untrusted code (schema validation before execution, forbidden constructs rejected, sandboxed run). A test that cannot be written faithfully (network, DOM, missing external dependency) yields `repro-unavailable`, not a dropped finding.

## Quick start

```bash
make demo        # deterministic end-to-end demo, mock adapter, no network
make test        # L1/L2 gate, L3 runner, dirty JSON, fault injection, config hash (Node >= 22)
make controlled  # controlled verifier test: injected candidates, real API (needs MODEL_API_KEY)
make bench       # scored benchmark: bench/seed-repo, MAX_FINDINGS=12, mode bench (needs MODEL_API_KEY); REPRO=0 disables L3
DUAL_SCAN=1 make bench  # both models scan; each candidate is verified by the other model
CHUNKED_SCAN=1 make bench  # one focused scanner call per top-level directory (higher recall, see below)
make score       # score the newest benchmark run; RUN=reports/<id> selects one explicitly
make integrity   # v0.2.0 gate: frozen baseline hashes, no diff under frozen paths, test locks
node src/cli.mjs replay reports/v0.2.0/f2-mini-repo/72becdf8e629b60f --anchor HEAD --out /tmp/replay
make replay      # re-run L0/L1 over the committed golden artifacts (no model calls)
make clean-clone # fresh clone in tmpfs with env -i, make test/demo/score
make clean-clone-docker # same inside node:22-alpine (needs Docker)
make probe-repo ARGS="--repo <url> --commit <sha> --scope <dir> --runs 2 --dry-run"
make ablation   # held-out fixture through four gate levels (scanner / +L1 / +L2 / +L3)
make three-way RUN=reports/<id>  # Spark alone vs Wonder alone vs CodeProof on the same task (bench fixture)
node scripts/reverse-verify.mjs --repo <dir> --ablation <json> --variant wonder-only  # cross-examine a single model's findings
node scripts/chunked-scan.mjs --repo <dir> --expected <expected.json>  # scanner-only recall of a chunked scan (evidence: 11/16 for $0.245)
```

Every run directory contains `REPORT.md` (the report) and `REPORT.html` (a self-contained static view of the same evidence: evidence funnel, per-finding proof level, `[CONTROL]`/`[TRIGGER]` code, LinkCheck method, patch diff and the rejected candidates - no JavaScript, no network), plus `findings.json`, `rejected.md`, `run.json`, `repro/` and `patch/`.

Budgets: each run has a hard cap (`BUDGET_USD`, default 2 USD). Before every model call the agent layer estimates the worst-case price (input tokens at 3 chars/token, no cache hits, the full `max_tokens` output budget) and **refuses the call if it would not fit**; the default is a hard gate, `HARD_BUDGET=0` restores the old post-hoc behaviour. `run.json` records `budget.hard`.

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
| Calibration benchmark (n=8) | [reports/golden/](reports/golden/) | 8/8 spatial recall (file + line match), 100% precision, 0/4 traps proposed and 0/4 published, 9/9 published findings execution-proven | a statistical or semantic claim; the set was used for calibration, and semantic correctness is the hand-checked adjudication |
| Real repository (unjs/ofetch) | [reports/real-world/ofetch/](reports/real-world/ofetch/) | 4/4 verified, all four match open upstream issues/PRs | novel discovery - the commit and issues are public |
| Real repository (unjs/ofetch) with L3 | [reports/real-world/ofetch/l3/](reports/real-world/ofetch/l3/) | one finding **execution-proven**: generated test reproduces the `isJSONSerializable(null)` TypeError on the analyzed commit (matches upstream issue #571) | one repository, n = 2 runs; the commit and issue are public |
| Real-repository probe round with L3 (4 repos) | [reports/real-world/probes-27-10/](reports/real-world/probes-27-10/) | defu, p-queue, zustand, yup: 7 candidates, 6 published (4 hand-confirmed), no false positives; L3 reported `repro-unavailable` on the TypeScript trees | not a benchmark; one run per repository, n = 4 |
| Real-repository probe round II with L3 (5 repos) | [reports/real-world/probes-27-10b/](reports/real-world/probes-27-10b/) | semver, dotenv, json5, ufo, validator.js: 11 candidates, 10 published (4 hand-confirmed), 1 L1 reject, **1 execution-proven** (`LRUCache.set` loses the entry on update) | not a benchmark; one run per repository, n = 5 |
| Dual-scanner run (ufo) | [reports/real-world/dual-scan/](reports/real-world/dual-scan/) | same commit as the single-scanner run: **4 → 10 published findings** (6 proposed only by Wonder, each cross-verified by Spark), 0 false positives, 3x cost | one run, n = 1; same vendor family |
| Dogfooding - CodeProof on its own `src/` | [reports/v0.2.0/self-analysis/](reports/v0.2.0/self-analysis/) | 21 files / 4,221 LOC: single 3 verified + 1 patch-proven ($0.90), dual 1 verified ($1.41, secondary Wonder scan failed), chunked 9 verified + 2 patch-proven ($2.26); 10 unique findings, all fixed (7 in `52e6606`, 3 in `b41f256`), 234/234 tests, replay PASS without an API key | one target (the project itself), n = 1 per architecture |
| Model ablation on `src/` (same target) | [reports/model-ablation/](reports/model-ablation/) | Spark-alone 4/4 L1-valid candidates for $0.136; Wonder-alone empty output after the truncation retry for $1.217; CodeProof 3 verified for $0.897 | n = 1 per variant |
| Three architectures on one task | [reports/three-way/](reports/three-way/) | Spark-alone 8/8 candidates ($0.026), Wonder-alone 7/8 ($0.135), CodeProof 8/8 **verified** + 8 execution proofs ($0.76); on ufo: 4 vs 7 unverified vs **10 verified**. Verification is what costs; scanning with the cheap model keeps it affordable | n = 1 per variant, calibration fixture + one real repo |
| Extended evaluation: real code, frozen | [bench/extended/](bench/extended/) | 16 injected defects + 5 traps in axios `lib/` (74 files / 9,564 LOC): 4-7/16 verified per single-pass run, **9-10/16 with chunked scanning**, 0/5 traps published, mean $0.76/run (single) or $2.08/run (chunked); four runs with `MAX_FINDINGS` 8 and 20 all reported | an organic-bug discovery rate - the defects are injected; n = 16 is larger but still small |
| Recall levers on the extended set | [bench/extended/README.md](bench/extended/README.md) | chunked scanning raises scanner recall 8/16 (50%) -> **11/16 (68.8%)** for $0.245; the dual scanner does not help here (7/16, one trap leaked) | n = 2 chunked runs; one set, one repository |
| Real repository (sindresorhus/execa) | [reports/real-world/execa-lib/](reports/real-world/execa-lib/) | 1 verified finding in run 2 (0 in run 1): Windows shebang parser drops interpreter arguments; hand-checked | a hit-rate claim; 2 runs, public commit, the Windows path was not executed |
| Real repository (preactjs/preact) | [reports/real-world/preact-src/](reports/real-world/preact-src/) | 1 verified (refQueue not rolled back on a diff error) + 2 uncertain in run 2; 0 in run 1 | a hit-rate claim; static adjudication, error-boundary path only |
| Real repository (moment/luxon) | [reports/real-world/luxon-src/](reports/real-world/luxon-src/) | 1 verified in both runs (latent internal `uncomputeOrdinal` defect; public dates correct) + 1 organic refuted claim in run 2 | a hit-rate claim; the verified finding is latent, static + public-API adjudication |
| Real-API probe round: axios (real + injected) | [reports/probes/real/axios-lib/](reports/probes/real/axios-lib/), [reports/probes/real/axios-injected/](reports/probes/real/axios-injected/) | clean: 0 then 1 verified (an upstream revert regression); injected: 3/6 controlled defects in both runs, L1 100% | not a benchmark metric; the 6 defects were injected for this probe |
| Real-API probe round: fastify | [reports/probes/real/fastify-lib/](reports/probes/real/fastify-lib/) | 3/3 verified; hand check: F-001 confirmed, F-002/F-003 partially confirmed at lower severity | not a benchmark metric; static adjudication for F-002/F-003 |
| Safety / prompt-cache TTL / parallel probes | [reports/probes/](reports/probes/) | no content_filter on inert payloads; cache served at +2/+5/+10 min; 6/6 small parallel calls OK, shared prefix cache on 2/3 | single-run probes; no completeness or stability claim |
| Controlled verifier | [reports/controlled-verifier/](reports/controlled-verifier/) | a strong refutation carries a machine-checked counter-citation | a scanner output - candidates are injected |
| Historical recall (n=9) | [reports/historical/](reports/historical/) | 2/9 known fixes found; 7 known fixes missed | a benchmark metric; n=9, single directory per test |
| Upstream impact (3 filed findings) | [picomatch #243](https://github.com/micromatch/picomatch/issues/243), [picomatch #242](https://github.com/micromatch/picomatch/issues/242), [jsesc #79](https://github.com/mathiasbynens/jsesc/issues/79) | three findings from the v0.2.2 sample were filed as upstream issues (28 Oct 2026); other contributors opened a fix PR for all three within 24 hours | they are **open and unmerged** as of 29 Oct 2026; a case study (n = 3), not a benchmark metric - see [Upstream impact](#upstream-impact-qualitative) |

`run.json` keeps the local path of the analyzed checkout; it is provenance, not required for reproduction.

## Benchmark results

Scored on the **calibration set**: frozen synthetic fixture with 8 injected defects, 4 traps and 2 pre-registered extra defects - 15 files / 229 LOC. Artifacts of the current run are committed verbatim in [reports/golden/](reports/golden/) (`run.json`, `findings.json`, `REPORT.md`, `rejected.md`, and `repro/<findingId>/` with every generated test and its runner result).

| Metric | Current (strict L1 + L3, golden `de7a1ccf`) | Previous run (`231fc717`, no L3) | Threshold |
|---|---|---|---|
| End-to-end recall (verified) | **8/8 (100%)** | 7/8 (87.5%) | >= 6/8 |
| Precision (verified-only) | **100%** (8 TP, 0 FP) | 100% (7 TP, 0 FP) | >= 90% |
| Traps proposed by the scanner | **0/4** | 0/4 | reported |
| Traps published as verified | **0/4** | 0/4 | 0/4 |
| False refutations | **0** | 0 | <= 1 |
| Findings execution-proven (L3) | **9/9 published** | not run | reported |
| Candidates rejected at L1 | **0** | 1 | reported |
| Cost / duration | **$0.6204** / 168.8 s | $0.2947 / 98.8 s | measured |
| Prompt cache | 3,580 of 25,322 input tokens | 2,000 of 18,974 | reported |
| Verifier context | bounded to 24,000 characters | bounded to 24,000 characters | - |
| Scanner / verifier prompts | v3 / v1 (neutral examples) | v3 / v1 | - |
| Reproducer model | `muse-wonder-1.0`, at least 3 runs x 2 s default timeout | - | - |

Every published finding in this run has an execution proof: the model wrote a test, the test failed on every run (at least three) on the analyzed commit with a real `node:assert` failure, and the test and its output are committed under [reports/golden/repro/](reports/golden/repro/). The scanner found all nine candidates this time; model output is not bit-identical, so the earlier 7/8 run (one candidate rejected at L1) is kept in the history and in [reports/golden/README.md](reports/golden/README.md).

**Attempts (no cherry-picking):** eight benchmark attempts. (1) invalidated: ingest included `dist/` build artifacts, fixed in `b0e6568`; (2) valid baseline: 7/8; (3) aborted: scanner output truncated at the token limit, tooling fixed in `d0cde39`; (4) valid post-calibration run: 8/8; (5) F4 validation run before the configuration hash fix: 8/8; (6) F4 final run: 8/8 (previous gate); (7) strict-L1 run: 7/8; (8) strict-L1 + L3 run: 8/8 with 9/9 execution-proven, shown above. Model output is not bit-identical, so the number of attempts is always stated.

This is a calibration set: prompts are tuned on the same fixture, so the numbers are **post-calibration** and n = 8 is not a statistical claim. L3 was also measured on the held-out set below and on one real repository (ofetch, see [Real-repository execution proof](#real-repository-execution-proof-qualitative)).

### Extended evaluation — injected defects in real code

The calibration fixture is deliberately small and synthetic. To measure the same pipeline on **real production code**, a second set was frozen before its first run: **axios `lib/` at `790b5ba`, 74 files / 9,564 LOC (as ingested), 16 injected correctness defects + 5 traps** ([bench/extended/](bench/extended/), generated by [scripts/make-injected.mjs](scripts/make-injected.mjs), scorer [scripts/score-injected.mjs](scripts/score-injected.mjs)). Its prompt was never tuned on this set.

| Run | Candidates | Defects verified | Precision | Traps leaked | Execution proofs | Cost |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 8 | **4/16 (25%)** | 100% | 0/5 | 3 | $0.5291 |
| 2 | 8 | **7/16 (43.8%)** | 100% | 0/5 | 5 | $0.7808 |
| 3 | 9 | **6/16 (37.5%)** | 85.7% | 0/5 | 4 | $0.8476 |
| 4 | 8 | **7/16 (43.8%)** | 100% | 0/5 | 5 | $0.8640 |

Mean verified recall **6.0/16 (37.5%)** at $0.76 per run; **no trap was published in any run**, and three of four runs had perfect verified precision. Reading: on real code of this size the scanner misses many subtle defects - the calibration 8/8 does not transfer - but what the pipeline publishes is verifiable and almost always correct. Both sets are reported, neither replaces the other.

**Recall levers, measured on the same frozen ground truth:** the effective one is **chunked scanning** (`CHUNKED_SCAN=1`, one focused scanner call per top-level directory): scanner recall before verification goes from 8/16 (50%) to **11/16 (68.8%)** at $0.245, and the full pipeline verifies **9-10/16 (mean 59.4%)** with 0/5 traps. The dual scanner does **not** help here (7/16, 3.5x cost, one trap leaked): a second model does not fix a context that is too broad. Details and all runs: [bench/extended/README.md](bench/extended/README.md).

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

### v0.2.2: real-world sample (ten repositories, 23 runs)

The full L0-L4 chain was run on ten real repositories with **zero runtime dependencies**, on Node 26.8.2 and at fixed commits; six of them were run 2-5 times to measure variance, and the two hardest (commander, marked) plus the two proof targets (picomatch, jsesc) were re-run with the v0.2.2 rules. Every artifact is committed under [reports/v0.2.0/real-world/](reports/v0.2.0/real-world/).

| Repository | Target | Runs | Proposed | Verified | Runs with execution proof | patch-proven runs | Cost |
|---|---|---:|---:|---:|---:|---:|---:|
| [micromatch/picomatch](https://github.com/micromatch/picomatch) `4.0.7` | `lib/` 5 f / 2,445 LOC | 5 | 16 | 11 + 1 moderate | **5** | **4** | $5.0507 |
| [markedjs/marked](https://github.com/markedjs/marked) `v15.0.12` | `src/` 13 f / 3,344 LOC (ESM TS) | 3 | 8 | 7 + 1 moderate | 0 | 0 | $2.9009 |
| [tj/commander](https://github.com/tj/commander.js) `v14.0.0` | `lib/` 6 f / 4,193 LOC | 3 | 2 | 2 | 0 | 0 | $1.5298 |
| [mathiasbynens/jsesc](https://github.com/mathiasbynens/jsesc) `v3.1.0` | `jsesc.js` 337 LOC | 3 | 3 | 3 | **3** | **2** | $0.8432 |
| [iamkun/dayjs](https://github.com/iamkun/dayjs) `v1.11.9` | `src/` 3 f / 548 LOC (ESM) | 1 | 3 | 3 | 0 | 0 | $0.6194 |
| [json5/json5](https://github.com/json5/json5) `v2.2.3` | `lib/` 13 f / 1,708 LOC | 2 | 0 | 0 | 0 | 0 | $0.1533 |
| [mathiasbynens/he](https://github.com/mathiasbynens/he) `v1.2.0` | `he.js` 345 LOC | 2 | 0 | 0 | 0 | 0 | $0.2540 |
| [WebReflection/flatted](https://github.com/WebReflection/flatted) `v3.4.1` | `cjs/` 1 f / 132 LOC | 2 | 0 | 0 | 0 | 0 | $0.0906 |
| [npm/node-semver](https://github.com/npm/node-semver) `v7.8.5` | `ranges/` 11 f / 540 LOC | 1 | 0 | 0 | 0 | 0 | $0.0314 |
| [primus/eventemitter3](https://github.com/primus/eventemitter3) `5.0.4` | `index.js` 336 LOC | 1 | 0 | 0 | 0 | 0 | $0.0237 |
| **total** | | **23** | **31** | **26 (+2 moderate)** | **8** | **6** | **$11.4971** |

- **Variance is measured, not hidden:** picomatch 1 / 3 / 2 / 3 / 2 verified per run (patch-proven 0 / 2 / 1 / 2 / 1), marked 5 / 1 / 1, commander 1 / 1 / 0 (the third run's citation failed L1), jsesc 1 / 1 / 1, and json5, he and flatted returned 0 candidates in every run. All runs are committed.
- **Execution and patch proof on real CommonJS targets:** picomatch (five execution proofs, four patch-proven runs) and jsesc (three execution proofs, two patch-proven runs) - **two different repositories**. jsesc: `jsesc(-255, {numbers: 'hexadecimal'})` returns `"0x-FF"`, an invalid literal; the patch emits `-0xFF` and falls back to `String(value)` for non-integers. picomatch: an unmatched `)` drives `state.parens` to -1, `noext: true` clears `isGlob`, and a leading slash skips the last token update; the patches are committed.
- **Fail-closed is measured:** the process-signal domain (commander) and ESM/TypeScript targets without a build step (marked, dayjs) stay `verified`; none was promoted to an execution proof by force.
- **Hand adjudication:** the 17 unique verified findings were read against the code (and executed where the clone was executable): 17 confirmed, 0 refuted; 9 are machine-proven. This is a sample statement, not a precision metric.
- **v0.2.2 verification runs (P1/P2):** after the patcher retry was added, picomatch runs 4-5 and the third jsesc run recovered **three previously lost `patch-proven` proofs** (the `prevIndex` token, `noext` and the jsesc negative-number literal); picomatch run 4 records 4 patcher calls for 2 patch proofs, which is the retry visible in `run.json`. The reproducer-prompt change (P2) **did not** remove the L0 rejections in this sample - the model still failed to tie assertions to a call - so it remains a prompt-level improvement, not a demonstrated fix. Cost of the verification runs: $2.7680.

## Upstream impact (qualitative)

The v0.2.2 sample was also filed back into the projects it analyzed. Three findings were reported in the public trackers on 28 Oct 2026; within 24 hours, **other contributors opened a fix PR for all three**, each linking the report and changing the code the pipeline had cited.

| Finding (as published) | Project | Filed report | External fix PR | Status, 29 Oct 2026 |
|---|---|---|---|---|
| an unmatched `)` drives `state.parens` to -1 and corrupts later groups | [micromatch/picomatch](https://github.com/micromatch/picomatch) | [#243](https://github.com/micromatch/picomatch/issues/243) | [#245](https://github.com/micromatch/picomatch/pull/245) by Ekko82 - applies the guard proposed in the report verbatim and names the reporter | open |
| `noext: true` also clears `isGlob`, so plain globs are reported as non-globs | micromatch/picomatch | [#242](https://github.com/micromatch/picomatch/issues/242) | [#244](https://github.com/micromatch/picomatch/pull/244) by junaidkhan80121 - `Closes #242` | open |
| radix `numbers` modes emit invalid JavaScript literals for negative, fractional and non-finite values | [mathiasbynens/jsesc](https://github.com/mathiasbynens/jsesc) | [#79](https://github.com/mathiasbynens/jsesc/issues/79) | [#80](https://github.com/mathiasbynens/jsesc/pull/80) by fly1d - "Keep non-integer numbers valid in radix modes"; covers the fractional and non-finite part, the negative-integer sign stays with #73/#76 | open |

- **What this shows:** the findings are real defects that other developers considered worth fixing, and the reports - including their one-line guards - were actionable enough to be reused. PR #245 applies the guard proposed in the report and cites the reporter by name.
- **What this does not show:** the PRs are **open and unmerged**, with no maintainer response yet, so the correct status is "filed and picked up", not "accepted upstream". It is not a novel-discovery claim: the analyzed commits are public and the jsesc topic already had upstream PRs ([#73](https://github.com/mathiasbynens/jsesc/pull/73), [#76](https://github.com/mathiasbynens/jsesc/pull/76)) before the report, and the two picomatch reports have no earlier issue for those exact lines as far as the public tracker was checked. It is a case study (n = 3), not a recall, precision or cost measurement.
- **Evidence chain:** the upstream posts are external links, not run artifacts; the in-repository evidence that these findings were published as reported is the committed runs under [reports/v0.2.0/real-world/](reports/v0.2.0/real-world/) - the two filed picomatch findings and the jsesc finding are `patch-proven` in the v0.2.2 table above, i.e. the proposed fix was already in the artifacts when the reports were filed.

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

Capabilities built after the initial pipeline, each with its own evidence: commit-based ingestion (dirty working trees cannot change the analysis), a hard pre-flight budget gate, stricter L3 admission (the generated test must import **and call** repository code, no non-determinism), the **dual-scanner** mode with cross-model verification, the **chunked** scanning mode for recall on real code, the frozen **extended evaluation set**, and the three-way / model-ablation / reverse-verification experiments under `scripts/`.

## Limits

- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- **Budget is enforced up front, but with an estimate:** the hard gate uses a conservative heuristic (3 chars/token, no cache, full output budget). It can therefore refuse a call that would in reality have fit; it prevents runaway spend from a single request, but it is not a formal upper bound on tokenizer variance or on retry traffic. `HARD_BUDGET=0` disables the pre-flight gate and keeps only the post-hoc limit.
- **The semantic tie is a review, not a machine proof.** The mechanical chain proves that the control passes and the trigger fails on every run (at least three), that the imported symbol executed, and (for L4) that a patch flips the result. That the failure corresponds to the claimed defect is judged by an independent semantic review (F1.11), recorded in [reports/v0.2.0/F1-SEMANTIC-REVIEW.md](reports/v0.2.0/F1-SEMANTIC-REVIEW.md); the report never claims otherwise.
- **Output isolation:** `analyze` refuses an output directory inside the analyzed repository unless `--allow-output-in-target` is passed (scan diagnostics follow `--out` too; symlinked output paths are resolved before the check). This keeps the "nothing is written to the analyzed repository" claim enforced rather than aspirational.
- **`REPORT.html` is a view, not a new proof.** Each run writes a self-contained HTML copy of the recorded evidence; it contains no JavaScript, makes no network requests and re-runs nothing. Offline replay verifies its hash through `run.json.attestation` but does not regenerate it. Runs made before this feature have no HTML file, and their attestation stays valid because it lists only the artifacts that existed at the time.
- **`patch-proven` is differential, not a root-cause fix.** The patch is applied to a copy of the snapshot and never written to the analyzed repository; the repository's own test suite is not run.
- **L3/L4 proof requires Node 26.8.2.** Node 22.23.3 has no `--allow-inspector`, so LinkCheck returns `link-unproven`, the finding stays `verified`, and no execution/patch proof is awarded (fail-closed). `--allow-inspector` carries Node's PERM0004 warning; it is needed only to read coverage from memory, and the sandbox still has no write and no network permissions.
- **Real-code recall is lower than the calibration numbers.** On the extended set (16 injected defects in axios `lib/`, 9,564 LOC) the scanner verified 4-7 of 16 across four single-pass runs (~37% mean; **9-10/16 with chunked scanning**), while publishing no trap and almost no false positive. The calibration fixture is easier than production code; both numbers are published and labelled.
- **Large repositories are analysed partially.** The scanner prompt is capped at 400,000 characters; above roughly 15-20k LOC only an alphabetical prefix of the files reaches the model. The run reports this honestly (console warning, `run.json.scanCoverage`, a line in the report summary), but the selection is not relevance-aware: for a large repository, run the pipeline per directory (`analyze <repo>/src/router`) or raise the cap deliberately.
- No completeness claim: the report shows what passed the gate, not everything that exists in a repository.
- L1 proves that every citation exists in the commit and matches the declared line range after whitespace normalization. Whether the claim matches the code is judged by the verifier model and is presented as such.
- TypeScript/JavaScript only. Scan and verify are static; L3 executes only the generated test in a sandboxed Node process. The test must import **and call** the analyzed repository code, the import must resolve inside the committed snapshot, it may not use non-deterministic or ambient APIs (`Math.random`, `Date.now`, `new Date`, `performance.now`, `process.env`, `node:fs`/`os`/`process`), and trivial assertions (`assert.ok(true)`, `assert.equal(1, 1)`) are rejected at L0 - a self-contained test is no proof of anything.
- **L3 caveats:** isolation is process-level (Node permission model + network guard + 2 s default timeout), not OS-level. TypeScript is executed through Node's built-in type stripping, so a repository that needs its own build step, external dependencies or extensionless internal imports yields `repro-unavailable` - most TypeScript source trees do use extensionless imports. **CommonJS repositories** (`require` resolution) and ESM with explicit `.js`/`.ts` extensions are directly executable. L3 has been measured on the calibration fixture, on ofetch (explicit extensions) and on semver (CommonJS); on the two probe rounds it was correctly reported as unavailable rather than faked whenever execution was not possible. A failing test proves that a concrete input misbehaves on the analyzed commit; combined with the claim it is evidence, not a semantic proof of every consequence.
- Hand checks may downgrade the scanner's severity (for example a latent internal defect or an error-path-only issue); such findings are labelled as latent/partial in the corresponding HAND-CHECK.md. Real-repository findings are qualitative anecdotes, never benchmark metrics.
- **L3 classification caveat:** the runner classifies a crash as an assertion failure only when stderr starts with `AssertionError [ERR_ASSERTION]:`. A `node:assert` failure raised by the analyzed repository's own code (not by the generated test) produces the same marker and is classified the same way; the semantic tie to the claim is still the human review, not this classification.
- **Frozen-evidence errata (the files are frozen and stay as published):** (1) `bench/extended/README.md` states "28 published findings"; the four committed `findings.json` files sum to 25 verified (24 true positives plus one false positive); (2) the `bench/score.mjs --run .../run-1` command in the same file needs the generated run directory `run-1/<runId>`; (3) `reports/golden/README.md` states 32,504 output tokens, while `reports/golden/run.json` records 31,261; (4) `reports/probes/REAL-WORLD-ROUND.md` says the clean clone runs "without HOME" - `scripts/clean-clone.sh` sets an isolated temporary `HOME`, not none - and its "BUDGET_USD does not change the config hash" observation was a v1-payload result (the v2 payload includes the budget); (5) `reports/three-way/README.md` was corrected in place (not frozen) to say 8/8 problems for the no-L3 run. (6) `bench/README.md` documents `npm run build` for the fixture; that script lives in `bench/seed-repo/package.json` (use `npm --prefix bench/seed-repo run build`). All current numbers in this README are the corrected ones.
- **Self-analysis (v0.2.1):** one target (the project's own `src/`), n = 1 per architecture, so it is dogfooding, not a benchmark. The dual run degraded to the primary scanner (the Wonder secondary scan failed) and Wonder-alone returned an empty output after its truncation retry. All ten defects found there are now fixed; the last three (ingest LOC accounting, prompt separator budget, ASI from-scan) were fixed in commit `b41f256` with regression tests.
- **Which repositories can earn L3/L4 today:** execution proofs require a repository that Node can execute directly from the snapshot - CommonJS, or ESM with explicit file extensions, and no uninstalled external packages. In the v0.2.2 real-world sample, CJS/zero-dependency libraries earned `execution-proven`/`patch-proven` (picomatch, jsesc), while TypeScript source trees that need a build step or path aliases (marked, dayjs) stayed at L2 `verified` because the generated test cannot execute them. LinkCheck linkage proof additionally requires Node 26 (`--allow-inspector`).
- **LinkCheck granularity:** the linkage proof is `symbol` granularity when the imported binding appears in V8 coverage. For barrel re-exports (the test imports `./index.js` but the cited file is `./lib/parser.js`) and anonymous/default exports it is `file` granularity - the cited file executed - and `linkcheck.method` records which one applied. The cited file is always the first target checked, together with every repository import of the test; a test that only executes an unrelated import no longer earns the label.

## License

MIT (see [LICENSE](LICENSE)). Source snippets quoted from analyzed repositories keep their original license; each report links the analyzed repository and commit.
