# Dual-scanner runs on real repositories (27.10.2026)

`DUAL_SCAN=1` on real repositories, each with the same commit as an earlier single-scanner run. The dual mode runs both Meta models as producers, collapses duplicates, and cross-verifies every finding with the model that did not propose it.

| Repo | LOC | Secondary scanner (Wonder) | Unique proposed | Verified | Reproduced | Cost | Duration |
|---|---:|---|---:|---:|---:|---:|---:|
| [unjs/ufo](https://github.com/unjs/ufo) `f06c800` | 1,571 | **ok**, 8 candidates | **10** (Spark 4 / Wonder 8 / both 2) | **10** | 0 (L3 unavailable) | $2.0685 | 656 s |
| [npm/node-semver](https://github.com/npm/node-semver) `7257c14` | 7,581 | truncated at 32k, `fetch failed` | 2 (Spark 2) | 2 | **2** | $2.2503 | 493 s |
| [markedjs/marked](https://github.com/markedjs/marked) `4bdd7e0c` | 4,070 | truncated at 48k, `fetch failed` | 3 (Spark 3) | 2 + 1 uncertain | **2** | $1.2403 | 1,905 s |

Baseline single-scanner runs on the same commits: ufo 4 verified, semver 1 verified (LRU cache), marked 1 verified + 2 uncertain (Lexer `state.top`).

## Result 1 — ufo: the mode works as designed

Wonder proposed 8 candidates, Spark 4; two overlapped and collapsed into findings proposed by both models. The merged set is **10 verified findings, 0 false positives**, six of which the single-scanner pipeline could not publish because its producer never proposed them. Each of the six Wonder-only findings was cross-examined by Spark and confirmed. This is the clearest evidence for dual-scan: recall 4 → 10 at unchanged precision.

## Result 2 — semver and marked: Wonder cannot finish a larger scan, and the run degrades safely

On semver (7.6k LOC) and marked (4k LOC) the Wonder scanner hit `finish_reason=length` even with a doubled output budget and the retry failed with `fetch failed`. The pipeline **did not fail the run**: it recorded the secondary scanner as `status: error` in `run.json.scanners`, warned once, and continued with Spark only. Both runs still produced execution-proven findings:

- semver: the known `LRUCache.set` defect plus a **new confirmed finding** — cloning a `SemVer` with different options re-parses `version.version`, which excludes build metadata, so build identifiers are lost; the generated test fails 3/3.
- marked: two execution-proven findings — `Lexer.lex` reuses `this.tokens` without clearing it (a second `lex()` appends to the first result), and the `Parser` extension fallback returns an empty string instead of throwing for an unknown block token whose extension renderer returns `false`.

## What we learned

1. **The secondary scan is only practical on small targets.** Wonder spends its output budget on reasoning; it finished a 1.5k-LOC target comfortably, but not 4k or 7.6k LOC even at 48k output tokens. The run does not break — it degrades to the primary scanner — but the money is spent on the failed attempts ($2.25 and $1.24 for runs that end up single-scanner).
2. **A LOC guard is now available:** `DUAL_SCAN_MAX_LOC=2500` skips the secondary scan above that size, records `status: skipped-loc` with the reason in `run.json`, and saves the wasted spend. Off by default (0).
3. **Cross-verification worked in every direction it was exercised:** Wonder-only findings were confirmed by Spark (ufo), and Spark-only findings were confirmed by Wonder (all three runs, `verifier: muse-wonder-1.0`).
4. **Dual-scan is not a free recall boost on every repository.** On targets where the second scanner cannot finish, it is just an expensive single-scanner run - which is why the mode stays opt-in and the per-scanner outcome is recorded.

## Caveats

- One run per repository, n = 3; model output is not bit-deterministic (Spark proposed 4 candidates on ufo in one run and 3 in another marked run; the marked dual run found different defects than the single run).
- Both models are from the same vendor family: cross-verification is independent by role and model, not by provenance.
- L3 ran on semver and marked (CommonJS / explicit `.ts` imports) and did not run on ufo (extensionless TypeScript imports).

Artifacts: `ufo/ced2e69aa61578a4/`, `semver/a1f908e71a5d1869/`, `marked/2d8a93e9b019f92a/`.