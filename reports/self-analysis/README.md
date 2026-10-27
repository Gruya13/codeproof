# CodeProof on itself — self-analysis and separated models (27.10.2026)

## 1. The tool reviewed its own source

Run `afe3e8dd50723038` on `src/` (13 files / 2,626 LOC, mode smoke, L3 enabled): **6 proposed → 5 verified + 1 moderate, 4 execution-proven**, $1.0390, 258 s. Artifacts in this directory.

All six findings were about the pipeline's own correctness, and **all six were real** — including two defects that had been introduced hours earlier in the hard-budget and L3-hardening work. Each was fixed together with a regression test; this document records the finding and the fix.

| # | Finding (what the tool said about itself) | Verdict | Fix |
|---|---|---|---|
| F-001 | `estimateCost` returned **0** for a model without a price, so the hard-budget gate computed a zero worst-case and could never refuse anything (reproduced) | **confirmed** | `estimateCost` returns `null` for unknown models; `Budget.canAfford` fails closed; the hard gate refuses with "price of model X is unknown" |
| F-002 | `costOf` returns `null` for an unknown model and `Budget.charge` ignores `null`, so `spentUsd` never grows and the cap silently disappears | **confirmed** | the agent layer now throws `UNKNOWN_PRICE` instead of running with an unmeasured budget |
| F-003 | L0's "used imported symbol" check stripped only single-line imports; continuation lines of a multi-line import stayed in the body and made unused symbols look used (reproduced) | **confirmed** | import statements (including multi-line) are stripped as whole statements before the symbol search |
| F-004 | trailing-comma tolerance in the dirty-JSON parser ran a naive regex that also rewrote commas inside string literals (`{"a": ",}"}` was corrupted) | **confirmed** | new `stripTrailingCommas` scanner that ignores string literals |
| F-005 | `isSnippetInExcerpts` returned `true` when no excerpt context was given, i.e. it claimed a snippet was present without any context (reproduced) | **confirmed** | fails closed (`false`) when there is no context |
| F-006 | an empty file was counted as 1 line of code (`"".split("\n")` has length 1) | **confirmed** | empty source counts as 0 lines |

Tests added for all six: unknown-price refusal (hard and accounting paths), multi-line import stripping, string-safe trailing-comma tolerance, fail-closed context check, empty-file LOC.

This is the strongest single piece of evidence for the trust contract: the published findings were not just plausible, four of them were proven by execution on the analyzed commit, and fixing them was verified by the deterministic suite (148/148).

## 2. Separated Meta models on the same code

Same repository, same scanner prompt/schema/digest, one pass per model (`scripts/model-ablation.mjs`, artifacts under `../model-ablation/ufo-b2dbad2-*`):

| Variant | Runs | Candidates | Overlap with CodeProof | New | Cost | Notes |
|---|---|---:|---:|---:|---:|---|
| Spark alone | 2 | 4, then 0 | 4/4, then - | 0 | $0.0702 + $0.0344 | large run-to-run variance on the same input |
| Wonder alone | 2 attempts | - | - | - | - | first attempt truncated at 16k output tokens, second failed (`fetch failed`) with a 48k output budget; Wonder as a standalone scanner does not finish reliably within a reasonable budget on this target |
| CodeProof (Spark + L1 + Wonder + L3) | 1 | 6 proposed → 5 verified | - | - | $1.0390 | 4 execution-proven |

**Interpretation.** On CodeProof's own code, Spark alone found only a subset of the findings and its output varied between identical calls (4 then 0 candidates). Wonder alone did not produce a parseable answer within a reasonable output budget. The full gate produced the five verified findings and four execution proofs - and, crucially, the *combination* was what made the findings trustworthy: the budget-bypass and import-stripping defects were verified and then reproduced by an independently written test.

## 3. Honest caveats

- One self-analysis run and one ablation run per model; model output is not bit-deterministic (Spark: 4 then 0 candidates on identical input).
- The self-analysis is not an independent audit: the same model family produced the findings, the verifier and the reproducer. The human review here was "read the code and fix it", and every fix has a deterministic test.
- The self-analysis found the two defects that had just been added in the same session, which is a fair demonstration of the gate but also a reminder that new code is where defects concentrate.
- L3 was executable on CodeProof's own source because every internal import uses an explicit `.mjs` extension.

## 4. What changed in the repository

All six fixes plus the corrected hard-budget abort message (`run aborted by the budget gate: ...`, `budget.abortReason` in `run.json`) and their regression tests. Deterministic suite: **148/148** on Node 22 and Node 26.