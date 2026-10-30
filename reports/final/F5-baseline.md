# F5 — baseline on the frozen revision (tag `v0.2.3-final`)

**Date:** 2026-10-30 (01:30 CET) · **Tag:** `v0.2.3-final` (annotated `4e19b81`) → revision **`490e302`**
**Executed by:** DSH orchestrator · **Cost:** $0 (everything deterministic, no model calls)
**Reason:** PREREG §4.6 / A1 condition 9 — the full DoD 2 control set **after the freeze**, on the tag.

| # | Check | Result |
|---|---|---|
| 1 | `make test` (Node 26.8.2) | **268/268**, 0 fail |
| 2 | `mise exec node@22.23.3 -- make test` | **268/268**, 0 fail |
| 3 | `node scripts/integrity.mjs` | **PASS 22 checks** (baseline `2040aa9`) |
| 4 | `make replay` | **9/9 identical, 0 mismatch** |
| 5 | `make score RUN=reports/golden` | **PASS** |
| 6 | `make demo` | MOCK MODE, PASS |
| 7 | `make clean-clone` (tmpfs, `env -i`) | **PASS** |
| 8 | `make clean-clone-docker` (`node:22-alpine`) | **PASS** (268/268, demo/replay/score) |
| 9 | `node scripts/final-budget.mjs audit` | **PASS** — 26 attempts, 23 artifacts, settled $15.7163, spentEffective $25.7163 |
| 10 | `git rev-parse v0.2.3-final:src` = `git rev-parse HEAD:src` | **`f874d642d96541c9afc62c2cc2fca0d3989ac9b3`** (code unchanged since the freeze) |
| 11 | `git status --porcelain` | clean after the F5 commits |

**Test count:** 268 (241 before the round + 22 F0 tests + 5 F1 regression tests). All new tests are locked
with test-lock; there are no changes to existing tests.

**Note on HEAD:** HEAD is above the tag (F1–F5 artifact commits); the `src` tree is identical to the tag in every
run (verifiable via `run.json.repo.commit:src`). Frozenness is proven by the `src` tree hash, not by HEAD.
