# F0 — deterministički baseline finalne runde

**Datum:** 2026-10-29. (posle 20:00 CET) · **Head:** `0b9eef4` · **Izvršio:** DSH orkestrator
**Povod:** PREREG §4.1 (F0) i A1 uslov 9; runda je odobrena 29.10. i sidrena commit-om `aa52b50`.
**Trošak F0:** **$0** — nijedan API poziv (sve lokalno; mock/lokalni testovi).

## 1. Deterministički kontrolni set

| Provera | Komanda | Rezultat |
|---|---|---|
| Testovi, Node 26.8.2 | `make test` | **263/263**, 0 fail |
| Testovi, Node 22.23.3 | `mise exec node@22.23.3 -- make test` | **263/263**, 0 fail |
| Integrity | `node scripts/integrity.mjs` | **PASS 22 checks** (baseline `2040aa9`) |
| Replay golden | `make replay` | **9/9 identical, 0 mismatch** |
| Score golden | `make score RUN=reports/golden` | **PASS** |
| Demo | `make demo` | MOCK MODE, exit 0 |
| Clean clone (tmpfs, `env -i`) | `make clean-clone` | **PASS** |
| Clean clone Docker `node:22-alpine` | `make clean-clone-docker` | **PASS** (node v22.23.4, 263/263, demo/replay/score) |

**Broj testova:** 241 (pre F0) + **22 nova** = **263**. Novi test fajlovi su zaključani test-lock-om:
`tests/final-budget.test.mjs` (21 test) i `tests/ablation-hard-budget.test.mjs` (1), autor **codex**
(commit testova `dcf1c8a`, lock `0b9eef4`).

## 2. F0 budžetski sloj (A1–A4)

| Stavka | Dokaz | Status |
|---|---|---|
| `scripts/final-budget.mjs` — `reserve / check / settle / audit` | implementirano; A4 §1 validacija (`measured:true` + konačan nenegativan broj; `ablation.json.costUsd`) | ✅ |
| `scripts/final-run.sh` — reserve → **git commit rezervacije** → run → settle → commit artefakata | git-anchored dry-run u privremenom repo-u: commit `485c9a2` (rezervacija) **pre** runa, `67b5dea` (settle+artefakti) posle; `audit PASS` | ✅ |
| Suvi test wrappera na mock runu (`USE_MOCK=1`, $0) | reserve → mock run → auto-detekcija run dir → settle; mock (`measured:false`) ispravno = **unknown-cost**, rezervacija ostaje u `spentEffective` (A4) | ✅ |
| `hardBudget` fix u `scripts/ablation.mjs` (A3 §1) | `BUDGET_USD=0.001` → **odbijen pre slanja** za **116 ms**: „the next call on muse-spark-1.3 could cost up to 0.0698 USD, which does not fit into the remaining 0.0010 USD“; trošak $0 | ✅ |
| Regresioni test hard-budgeta (A3 §1) | `tests/ablation-hard-budget.test.mjs` — pada ako `createAgents` izgubi `hardBudget: config.hardBudget` | ✅ |
| A4 §3 test tabela (9 obaveznih + 2 preciziranja) | `tests/final-budget.test.mjs` — 11 cost slučajeva + mehanika ledgera/CLI-ja | ✅ |
| `.gitignore` za `_repo` klonove | `git check-ignore` exit 0 | ✅ |
| `audit` na praznom pravom manifestu | `AUDIT PASS: 0 attempts, 0 artifacts` | ✅ |

**Napomena:** pravi `reports/final/ATTEMPTS.jsonl` još ne postoji — prvi pravi pokušaj je **F1 dogfood**;
F0 ne troši nijedan attempt. Rezervacije iz suvih testova su bile u `/tmp` ledgerima (van repoa), tako da
manifest runde počinje čisto od `attemptNo 1`.

## 3. Stanje pre F1

| Stavka | Vrednost |
|---|---|
| Head | `0b9eef4` (`main = origin/main` posle push-a) |
| Baseline trošak do sada | **$55,8970** (lock v1.5; F0 nije menjao) |
| Budžet runde | cilj **$35**, hard cap **$40**; ledger: `reports/final/ATTEMPTS.jsonl` |
| Docker | dostupan **bez sudo** (`node:22-alpine` PASS) |
| Node | v26.8.2 aktivan; v22.23.3 preko `mise` |
| Frozen artefakti | netaknuti (integrity PASS) |
| Git | radno stablo čisto; plan + F0 commitovani i push-ovani |

**Gate F0 → F1: ispunjen.** Sledeći korak: F1 dogfood (prvi plaćeni API poziv), kroz `final-run.sh`.
