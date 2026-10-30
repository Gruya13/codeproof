# PREREG AMENDMENT 3 — hermetic closure of the budget and the manifest

**Status: LOCKED v1.3** · date 2026-10-29. · basis: `PREREG.md` v1.0 + `AMENDMENT-1` (v1.1) + `AMENDMENT-2` (v1.2)
**Reason:** round 4: **agy = AGREE WITH CONDITIONS**, **codex = DISAGREE** — but **both about the same three real holes** (plus two operational addenda). This amendment closes them; the agreement from round 2 remains in force.
**Relation to the previous files:** the original plan and AMENDMENT-1/2 are **not changed**; this file is a supplement.

## 1. Hard budget in the ablation (R4-CX-1 / R4-AG-1)

**Finding (both confirmed, evidence in the code):** `scripts/ablation.mjs:88-92` creates a `Budget` but calls `createAgents` **without** `hardBudget`; `src/agents/index.mjs:139` activates the preflight only if `options.hardBudget` is truthy. That is why `BUDGET_USD` in the ablation is **not** a proven upper bound on cost (a soft cap overrun = one call).

**Solution (Phase 0, before Phase 3, before the freeze):**
- in `scripts/ablation.mjs` the `createAgents` call gets `hardBudget: config.hardBudget`;
- regression test: a static test that fails without that option + the existing agents hard-budget test; an assistant writes the test, it is locked with test-lock, the author is in the commit message;
- proof before Phase 3: `node scripts/ablation.mjs --repo bench/held-out` with a small `BUDGET_USD` → the call is refused **before** sending (hard gate), cost $0 for that proof.
- This makes `reservedUsd = BUDGET_USD` (2 USD) a **proven** upper bound for the ablation.

## 2. Settle for held-out from `ablation.json` (R4-CX-2 / R4-AG-2)

`final-budget.mjs settle --attempt <n> --artifact <path>`:
- standard run: reads `run.json.usage.costUsd`;
- **held-out: reads `ablation.json.costUsd` (root fields), status `ok`**; the field path is explicit, a missing field = `unknown-cost` (never a silent 0);
- it also checks that `artifact` is a directory that actually contains `run.json` or `ablation.json`; `runDir` is written into the manifest, `note` states where the cost came from.

## 3. Permanent anchoring before every API call (R4-CX-3 / R4-AG-3)

`scripts/final-run.sh` — mandatory order per attempt:
1. `final-budget.mjs reserve --attempt <n> --block <b> --label <l> --max <BUDGET_USD>` → writes the `reserved` line and checks `spentEffective + max <= 40`;
2. **`git add reports/final/ATTEMPTS.jsonl` and `git commit -m "attempt <n>: reserved <max> USD"`** (`-c user.name/codef` author fixed) — anchoring **before the money is spent**;
3. running the run;
4. `final-budget.mjs settle --attempt <n> --artifact <run dir>` → actual cost/status;
5. at the end of the block: `git add reports/final` + a commit carrying the artifacts and the settle records.
- Consequence: deleting the last line of the manifest does not erase the trace — the reservation is already in the git history; the verifier compares the git history of the manifest with the current state.
- `audit` before settle: lists all `run.json`/`ablation.json` under `reports/final` and compares them with the manifest; every artifact that is not in the manifest or is not anchored = **FAIL**.

## 4. Dangling reservations (R4-AG-4 / R4-CX-4)

- `check`/`reserve` before a new reservation: if there is a line with `status: reserved|started` (interrupted or in progress) → **abort** with instructions; the orchestrator must resolve it first (`settle` with the actual cost from the API log, or `unknown-cost` with the reservation).
- No piling up of reservations; no reservation is deleted.
- `spentEffective = Σ costUsd (settled) + Σ reservedUsd (reserved/started/unknown-cost)` — the ledger never underestimates.

## 5. Impact on the plan

- **Phase 0** gains: (a) the hardBudget fix in the ablation + regression test, (b) the implementation of `scripts/final-budget.mjs` and `scripts/final-run.sh`, (c) a dry run of the wrapper on a mock run (`USE_MOCK=1`, $0) before the first real API call; everything committed before Phase 1.
- **Phase 3** (held-out): before the run check that the fix is present; settle from `ablation.json`.
- **Phase 5**: the audit of the manifest and of the git history enters the final verification.
- The total budget and the 9 conditions from AMENDMENT-1/2 remain unchanged.

## 6. Lock v1.3 and round 5 (last)

- the new lock contains the sha256 for all four documents (PREREG + A1 + A2 + A3);
- round 5 is the **last** one per the agreement with the user: both reviewers confirm that the R4 findings are closed and that there are no new P0/P1; if both give `AGREE`, the plan is locked and the start only awaits user approval; if not, it is escalated to the user (5/5 rounds).
