# F0 — deterministic baseline of the final round

**Date:** 2026-10-29 (after 20:00 CET) · **Head:** `0b9eef4` · **Executed by:** DSH orchestrator
**Reason:** PREREG §4.1 (F0) and A1 condition 9; the round was approved on 29.10. and anchored by commit `aa52b50`.
**F0 cost:** **$0** — no API calls (everything local; mock/local tests).

## 1. Deterministic control set

| Check | Command | Result |
|---|---|---|
| Tests, Node 26.8.2 | `make test` | **263/263**, 0 fail |
| Tests, Node 22.23.3 | `mise exec node@22.23.3 -- make test` | **263/263**, 0 fail |
| Integrity | `node scripts/integrity.mjs` | **PASS 22 checks** (baseline `2040aa9`) |
| Replay golden | `make replay` | **9/9 identical, 0 mismatch** |
| Score golden | `make score RUN=reports/golden` | **PASS** |
| Demo | `make demo` | MOCK MODE, exit 0 |
| Clean clone (tmpfs, `env -i`) | `make clean-clone` | **PASS** |
| Clean clone Docker `node:22-alpine` | `make clean-clone-docker` | **PASS** (node v22.23.4, 263/263, demo/replay/score) |

**Test count:** 241 (before F0) + **22 new** = **263**. The new test files are locked with test-lock:
`tests/final-budget.test.mjs` (21 tests) and `tests/ablation-hard-budget.test.mjs` (1), author **codex**
(tests commit `dcf1c8a`, lock `0b9eef4`).

## 2. F0 budget layer (A1–A4)

| Item | Evidence | Status |
|---|---|---|
| `scripts/final-budget.mjs` — `reserve / check / settle / audit` | implemented; A4 §1 validation (`measured:true` + a finite non-negative number; `ablation.json.costUsd`) | ✅ |
| `scripts/final-run.sh` — reserve → **reservation git commit** → run → settle → artifact commit | git-anchored dry run in a temporary repo: commit `485c9a2` (reservation) **before** the run, `67b5dea` (settle+artifacts) after; `audit PASS` | ✅ |
| Dry run of the wrapper on a mock run (`USE_MOCK=1`, $0) | reserve → mock run → auto-detect run dir → settle; mock (`measured:false`) correctly = **unknown-cost**, the reservation stays in `spentEffective` (A4) | ✅ |
| `hardBudget` fix in `scripts/ablation.mjs` (A3 §1) | `BUDGET_USD=0.001` → **rejected before sending** in **116 ms**: "the next call on muse-spark-1.3 could cost up to 0.0698 USD, which does not fit into the remaining 0.0010 USD"; cost $0 | ✅ |
| Regression test for the hard budget (A3 §1) | `tests/ablation-hard-budget.test.mjs` — fails if `createAgents` loses `hardBudget: config.hardBudget` | ✅ |
| A4 §3 test table (9 required + 2 clarifications) | `tests/final-budget.test.mjs` — 11 cost cases + ledger/CLI mechanics | ✅ |
| `.gitignore` for `_repo` clones | `git check-ignore` exit 0 | ✅ |
| `audit` on an empty real manifest | `AUDIT PASS: 0 attempts, 0 artifacts` | ✅ |

**Note:** the real `reports/final/ATTEMPTS.jsonl` does not exist yet — the first real attempt is **F1 dogfood**;
F0 spends no attempt. Reservations from the dry tests were in `/tmp` ledgers (outside the repo), so the
round manifest starts clean at `attemptNo 1`.

## 3. State before F1

| Item | Value |
|---|---|
| Head | `0b9eef4` (`main = origin/main` after the push) |
| Baseline cost so far | **$55.8970** (lock v1.5; F0 did not change it) |
| Round budget | target **$35**, hard cap **$40**; ledger: `reports/final/ATTEMPTS.jsonl` |
| Docker | available **without sudo** (`node:22-alpine` PASS) |
| Node | v26.8.2 active; v22.23.3 via `mise` |
| Frozen artifacts | untouched (integrity PASS) |
| Git | working tree clean; plan + F0 committed and pushed |

**Gate F0 → F1: met.** Next step: F1 dogfood (the first paid API call), through `final-run.sh`.
