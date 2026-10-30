# F5 — baseline na zamrznutoj reviziji (tag `v0.2.3-final`)

**Datum:** 2026-10-30. (01:30 CET) · **Tag:** `v0.2.3-final` (anotiran `4e19b81`) → revizija **`490e302`**
**Izvrśio:** DSH orkestrator · **Trošak:** $0 (sve deterministički, bez model poziva)
**Povod:** PREREG §4.6 / A1 uslov 9 — pun DoD 2 kontrolni set **posle freeze-a**, na tagu.

| # | Provera | Rezultat |
|---|---|---|
| 1 | `make test` (Node 26.8.2) | **268/268**, 0 fail |
| 2 | `mise exec node@22.23.3 -- make test` | **268/268**, 0 fail |
| 3 | `node scripts/integrity.mjs` | **PASS 22 checks** (baseline `2040aa9`) |
| 4 | `make replay` | **9/9 identical, 0 mismatch** |
| 5 | `make score RUN=reports/golden` | **PASS** |
| 6 | `make demo` | MOCK MODE, PASS |
| 7 | `make clean-clone` (tmpfs, `env -i`) | **PASS** |
| 8 | `make clean-clone-docker` (`node:22-alpine`) | **PASS** (268/268, demo/replay/score) |
| 9 | `node scripts/final-budget.mjs audit` | **PASS** — 26 attempts, 23 artifacts, settled $15,7163, spentEffective $25,7163 |
| 10 | `git rev-parse v0.2.3-final:src` = `git rev-parse HEAD:src` | **`f874d642d96541c9afc62c2cc2fca0d3989ac9b3`** (kod nepromenjen od freeze-a) |
| 11 | `git status --porcelain` | čist posle F5 commitova |

**Test count:** 268 (241 pre runde + 22 F0 testa + 5 F1 regresionih testova). Svi novi testovi su zaključani
test-lock-om; izmene postojećih testova nema.

**Napomena o HEAD-u:** HEAD je iznad taga (artefakt-commitovi F1–F5); `src` tree je identičan tagu na svakom
runu (`run.json.repo.commit:src` proverljivo). Zamrznutost se dokazuje `src` tree hash-em, ne HEAD-om.
