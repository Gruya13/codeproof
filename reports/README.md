# Evidence index — every artifact, every round

This is the full index of committed evidence. The final round is summarized in [../README.md](../README.md);
its per-run artifacts, plans, hand-checks and verification records are in [final/](final/).

Every run keeps its raw artifacts verbatim: `run.json` (models, tokens, cost, duration, commit, repro counts),
`findings.json`, `REPORT.md`, `REPORT.html`, `rejected.md`, and `repro/`/`patch/` where a finding earned
an execution or patch proof. Numbers are only published when measured — `run.json` says `measured: false`
when they are not.

| Evidence | Artifact | What it shows | What it does not show |
|---|---|---|---|
| **Final round (29-30 Oct 2026, frozen `v0.2.3-final`)** | [final/](final/) | 268/268 tests; calibration 7/8, 7/8, dual 8/8; extended 9/16 chunked and 3/16 single; held-out 5/6 through L3; dogfood 5 defects fixed + 5 regression tests; 5 new real-world repositories × 2 runs → 12 hand-confirmed defects (1 unique defect patch-proven in both runs; 1 further candidate was rejected on review); regression pair re-confirming already-published picomatch/jsesc defects; every paid attempt in a git-anchored ledger | not a statistical claim (n=8 calibration, n=16 extended, small real-world sample); 3 of the 12 new-repository defects were already reported upstream before the round (mustache #854; mustache #762, closed in 2021; bcryptjs #170) and 3 were filed by us (fast-json-patch #337, dateformat #196, sax-js #303); single calibration recall is 7/8, not the expected 8/8 |
| Calibration benchmark (n=8) — historical | [golden/](golden/) | 8/8 spatial recall, 100% precision, 0/4 traps, 9/9 published findings execution-proven (26-27 Oct run) | a statistical or semantic claim; the set was used for calibration and the historical run predates the final round |
| Real repository (unjs/ofetch) | [real-world/ofetch/](real-world/ofetch/) | 4/4 verified, all four match open upstream issues/PRs | novel discovery — the commit and issues are public |
| Real repository (unjs/ofetch) with L3 | [real-world/ofetch/l3/](real-world/ofetch/l3/) | one finding execution-proven (reproduces the `isJSONSerializable(null)` TypeError) | one repository, n = 2 runs |
| Probe round I with L3 (4 repos) | [real-world/probes-27-10/](real-world/probes-27-10/) | defu, p-queue, zustand, yup: 7 candidates, 6 published (4 hand-confirmed), no false positives | not a benchmark; one run per repository |
| Probe round II with L3 (5 repos) | [real-world/probes-27-10b/](real-world/probes-27-10b/) | semver, dotenv, json5, ufo, validator.js: 11 candidates, 10 published, 1 execution-proven | not a benchmark; one run per repository |
| Dual-scanner run (ufo) | [real-world/dual-scan/](real-world/dual-scan/) | same commit as the single-scanner run: 4 → 10 published findings, 0 false positives | one run, same vendor family |
| Additional real repositories | [real-world/](real-world/) | execa, preact, luxon: one hand-confirmed finding each (luxon latent) | anecdotes, n = 1-2 per repo |
| Injected-defect rounds on axios `lib/` — historical | [../bench/extended/](../bench/extended/), final round in [final/bench-extended/](final/bench-extended/) | 16 injected defects + 5 traps; 4-7/16 per single-pass run, 9-10/16 with chunked scanning; 0/5 traps published | the defects are injected; not an organic discovery rate |
| Held-out generalization — historical | [ablations/](ablations/) | 5/6 defects, 4 ablation levels, 0 traps | one run; n = 6 is small |
| Dogfooding - CodeProof on itself (v0.2.1) | [v0.2.0/self-analysis/](v0.2.0/self-analysis/) | 10 unique defects, all fixed with regression tests; chunked 9 verified + 2 patch-proven | one target (the project itself) |
| Model ablation and three-way experiments | [model-ablation/](model-ablation/), [three-way/](three-way/) | producer-only vs verifier-only vs full pipeline on the same task | n = 1 per variant |
| Controlled verifier | [controlled-verifier/](controlled-verifier/) | a strong refutation carries a machine-checked counter-citation | candidates are injected, not scanner output |
| Historical recall (n=9) | [historical/](historical/) | 2/9 known fixes found | a benchmark metric; n=9 |
| Real-API probe round (axios, fastify, cache TTL, safety, parallel) | [probes/](probes/) | protocol and caveats in [probes/REAL-WORLD-ROUND.md](probes/REAL-WORLD-ROUND.md) (kept in Serbian — this file is part of the frozen evidence tree) | single-run probes; no stability claim |
| Upstream impact | picomatch [#242](https://github.com/micromatch/picomatch/issues/242), [#243](https://github.com/micromatch/picomatch/issues/243), jsesc [#79](https://github.com/mathiasbynens/jsesc/issues/79), and the final-round filings [#337](https://github.com/Starcounter-Jack/JSON-Patch/issues/337), [#196](https://github.com/felixge/node-dateformat/issues/196), [#303](https://github.com/isaacs/sax-js/issues/303) | defects filed back to the analysed projects; other contributors opened fix PRs for the v0.2.2 reports (all open and unmerged) | a case study, not a benchmark metric; none is claimed as accepted or merged |

The frozen rounds (golden, extended, held-out, v0.2.0/v0.2.2 samples, probes, controlled, historical) are kept
unchanged on purpose: they are the record of what was measured when. The final round is the only set measured
on the frozen tag; the `src` tree is `f874d642d96541c9afc62c2cc2fca0d3989ac9b3` (see [final/FREEZE.json](final/FREEZE.json)).
