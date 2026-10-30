# PREREG AMENDMENT 4 — strict validation of the cost type in `settle`

**Status: LOCKED v1.4** · date 2026-10-29. · basis: `PREREG.md` v1.0 + `AMENDMENT-1` + `AMENDMENT-2` + `AMENDMENT-3`
**Reason:** round 5 — codex `DISAGREE` (P0): A3:21 covers only a *missing* field, but not a present invalid value (`null`, string, negative number, `measured:false`); the historical mock `run.json` has `usage.costUsd: null` and `measured: false`. agy in the same round: `AGREE` with a note that the implementation must strictly validate the type. This amendment makes that **explicit, tested and binding**.
**Relation to the previous files:** none of the earlier files is changed; this file is a supplement.

## 1. Definition of a valid cost

**Standard run** (`run.json`): the cost is valid **only if** all of these hold:
```
run.json.usage.measured === true
&& typeof run.json.usage.costUsd === "number"
&& Number.isFinite(run.json.usage.costUsd)
&& run.json.usage.costUsd >= 0
```

**Held-out** (`ablation.json`, root): valid **only if**:
```
typeof ablation.json.costUsd === "number"
&& Number.isFinite(ablation.json.costUsd)
&& ablation.json.costUsd >= 0
```
(the ablation does not carry `measured`; the upper bound is guaranteed by the hardBudget fix from A3 §1.)

Everything else is **invalid**: `null`, `undefined`, a string (including `"0.5"`), a negative number, `NaN`, `Infinity`, `measured:false`, as well as a `measured` missing in `run.json`.

## 2. The `settle` rule

- **Valid cost** → `status: "ok"|"failed"`, `costUsd` = that number, `runDir` filled.
- **Invalid cost** → `status: "unknown-cost"`, `costUsd: null`, **`reservedUsd` stays permanently in `spentEffective`** until the actual cost is entered by hand from the API log; `note` names the reason (e.g. `costUsd=null`, `not measured`, `invalid costUsd: string`).
- **No settle may release a reservation without a valid number.** `spentEffective` never decreases without a valid cost.
- If the actual cost is entered by hand, it must pass the same validation (§1); otherwise it stays `unknown-cost`.

## 3. Tests (Phase 0, before the first API call)

Table of mandatory cases for `scripts/final-budget.mjs` (unit, without network):
| input | expected |
|---|---|
| `costUsd: 0`, `measured: true` | valid (`ok`, $0 is accepted) |
| `costUsd: 0.6204025`, `measured: true` | valid |
| `costUsd: null`, `measured: false` | `unknown-cost`, reservation stays |
| `costUsd: "0.5"` | `unknown-cost`, reservation stays |
| `costUsd: -1` | `unknown-cost`, reservation stays |
| `costUsd: NaN` / `Infinity` | `unknown-cost`, reservation stays |
| `measured` missing | `unknown-cost`, reservation stays |
| `ablation.json.costUsd: 0.277859` | valid |
| `ablation.json.costUsd` missing / not a number | `unknown-cost`, reservation stays |

- An assistant writes the test, commits it with the author in the message, test-lock; the orchestrator runs it and does not change it.
- In addition: a dry run of the wrapper (`final-run.sh`) on a mock run (`USE_MOCK=1`, $0) before the first paid call.
- Proof before Phase 3 (A3 §1): an ablation with a small `BUDGET_USD` refuses the call **before** sending (hard gate) — cost $0.

## 4. Impact

- The Phase 0 implementation of `final-budget.mjs` and `final-run.sh` includes these rules and tests.
- It changes neither the 9 conditions, nor the budget table, nor the hardBudget fix, nor the git anchoring, nor any earlier decision.

## 5. Lock v1.4 and round 6

- the new lock contains the sha256 for all five documents (PREREG + A1..A4);
- round 6: both reviewers confirm that the P0 from round 5 is closed and that there are no new P0/P1; if both give `AGREE`, the plan is locked and the start awaits user approval; if not, rounds 7–10 after user approval.
