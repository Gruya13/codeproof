# CodeProof

**AI review that publishes only what it can prove.**

A finding appears in the main report only if two independent gates pass:

1. **L1 - deterministic citation gate.** The cited file, line range and verbatim snippet exist in the analyzed commit. Checked by code, not by a prompt.
2. **L2 - adversarial verifier.** A different model (Muse Wonder) tries to refute the finding. A strong refutation must carry its own machine-checked counter-citation.

Everything that fails the gate is still published - in `rejected.md`, with the evidence that refuted it. The claim is not "we found everything". It is "we do not publish what we could not prove".

Built during the **Meta Global AI Developer Hackathon** (Oct 26 - Nov 4, 2026), Indie Developer track.

## Status

Milestone F1 is complete: the pipeline runs end-to-end on the mock adapter (`make demo`) and live against the Meta Model API (`mode: smoke`). First live runs on the 4-file demo fixture: 2 calls (Muse Spark 1.3 producer, Muse Wonder verifier), 1 finding passed both gates, 16.5 s wall time, **$0.0335 measured cost**; a second run measured **229 of 1365 input tokens served from prompt cache**. Numbers are only published when measured - `run.json` says `measured: false` when they are not. Benchmark recall and precision are measured next (milestones F2/F3).

A controlled verifier test (`make controlled`) closed the hard gate on the real API: two true findings were confirmed and one deliberately false claim was **refuted with a machine-checked counter-citation** (`src/batch.js:6`, verbatim `throw error;`). The run cost **$0.103** and served **3280 of 4065 input tokens from prompt cache**. It is recorded as `mode: controlled-verifier` and labelled as injected candidates in every report - never as scanner output.

## How it works

ingest -> scan -> verify -> publish

| Phase | What it does |
|---|---|
| ingest | fixes the file list, LOC and a sha256 manifest; builds a regex import graph and detects cycles |
| scan | the producer model (Muse Spark) returns findings as schema-constrained JSON: one claim, one verbatim citation, no speculation |
| verify | deterministic L1 citation check; then Muse Wonder tries to refute (strong refute needs a machine-checked counter-citation) |
| publish | `REPORT.md`, `findings.json` (status per finding), `rejected.md`, `run.json` (models, tokens, cache hits, cost, duration, commit) |

Static analysis only: the analyzed code is never executed, patched, or sent anywhere except the Meta Model API.

## Meta AI tooling used

- **Two models in one gate:** Muse Spark 1.3 as producer, Muse Wonder as adversarial verifier - not one model grading itself.
- **Schema-constrained decoding** (`response_format: json_schema`): the scanner cannot emit output that violates the schema, so L0 is structural instead of best-effort parsing.
- **Prompt caching:** the repository digest is a stable prefix; cached input tokens are read from `usage.prompt_tokens_details.cached_tokens` and written to `run.json`.
- **1M-token context** on both models: the analyzed repository fits without chunking (measured per run once the real API is wired in).

## Quick start

```bash
make demo        # deterministic end-to-end demo, mock adapter, no network
make test        # unit tests for the L1 gate, dirty-JSON parsing and run-id
make controlled  # controlled verifier test: injected candidates, real API (needs MODEL_API_KEY)
```

`make demo` prints a **MOCK MODE** banner and writes `mock: true` into `run.json`; the analyzed fixture is synthetic and checked in on purpose. A real run needs a key (never committed):

```bash
export MODEL_API_KEY=...
node src/cli.mjs analyze /path/to/repo
```

## Controlled verifier test

`make controlled` injects a small candidate set (two true findings and one false claim that cites real lines) directly into the verifier, bypassing the scanner. That is how the project proves that a strong refutation really carries a machine-checked counter-citation without waiting for the scanner to produce a false positive on its own. The run is recorded as `mode: controlled-verifier` and every report says so; it is never presented as scanner output. These results are not benchmark recall or precision.

## What was built during the hackathon

This repository is created during the hackathon; the first commit is tagged `hackathon-start`. All code, prompts and fixtures in this repository were authored during the event, and the git history is the evidence. Design notes written before the kickoff are not part of this repository.

## Limits

- Only direct correctness defects; omission, security and style findings are out of scope for this milestone.
- No completeness claim: the report shows what passed the gate, not everything that exists in a repository.
- L1 proves that a citation exists in the commit. Whether the claim matches the code is judged by the verifier model and is presented as such.
- TypeScript/JavaScript only, static analysis only.

## License

MIT (see [LICENSE](LICENSE)). Source snippets quoted from analyzed repositories keep their original license; each report links the analyzed repository and commit.
