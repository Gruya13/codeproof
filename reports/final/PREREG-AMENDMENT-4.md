# PREREG AMENDMENT 4 — striktna validacija tipa troška u `settle`

**Status: LOCKED v1.4** · datum 2026-10-29. · osnov: `PREREG.md` v1.0 + `AMENDMENT-1` + `AMENDMENT-2` + `AMENDMENT-3`
**Povod:** runda 5 — codex `DISAGREE` (P0): A3:21 pokriva samo *nedostajuće* polje, ali ne i prisutnu nevalidnu vrednost (`null`, string, negativan broj, `measured:false`); istorijski mock `run.json` ima `usage.costUsd: null` i `measured: false`. agy u istoj rundi: `AGREE` uz napomenu da implementacija mora striktno da validira tip. Ovaj amendment to čini **eksplicitnim, testiranim i obavezujućim**.
**Odnos prema prethodnim fajlovima:** nijedan raniji fajl se ne menja; ovaj fajl je dopuna.

## 1. Definicija validnog troška

**Standardni run** (`run.json`): trošak je validan **samo ako** su ispunjeni svi uslovi:
```
run.json.usage.measured === true
&& typeof run.json.usage.costUsd === "number"
&& Number.isFinite(run.json.usage.costUsd)
&& run.json.usage.costUsd >= 0
```

**Held-out** (`ablation.json`, koren): validan **samo ako**:
```
typeof ablation.json.costUsd === "number"
&& Number.isFinite(ablation.json.costUsd)
&& ablation.json.costUsd >= 0
```
(ablacija ne nosi `measured`; gornju granicu garantuje hardBudget fix iz A3 §1.)

Sve ostalo je **nevalidno**: `null`, `undefined`, string (uključujući `"0.5"`), negativan broj, `NaN`, `Infinity`, `measured:false`, kao i `measured` koje nedostaje kod `run.json`.

## 2. Pravilo `settle`

- **Validan trošak** → `status: "ok"|"failed"`, `costUsd` = taj broj, `runDir` popunjen.
- **Nevalidan trošak** → `status: "unknown-cost"`, `costUsd: null`, **`reservedUsd` ostaje trajno u `spentEffective`** dok se stvarni trošak ne unese ručno iz API loga; `note` imenuje razlog (npr. `costUsd=null`, `not measured`, `invalid costUsd: string`).
- **Nijedan settle ne sme da oslobodi rezervaciju bez validnog broja.** `spentEffective` se nikad ne smanjuje bez validnog troška.
- Ako se ručno unosi stvarni trošak, mora proći istu validaciju (§1); inače ostaje `unknown-cost`.

## 3. Testovi (Faza 0, pre prvog API poziva)

Tabela obaveznih slučajeva za `scripts/final-budget.mjs` (unit, bez mreže):
| ulaz | očekivano |
|---|---|
| `costUsd: 0`, `measured: true` | validan (`ok`, $0 se prihvata) |
| `costUsd: 0.6204025`, `measured: true` | validan |
| `costUsd: null`, `measured: false` | `unknown-cost`, rezervacija ostaje |
| `costUsd: "0.5"` | `unknown-cost`, rezervacija ostaje |
| `costUsd: -1` | `unknown-cost`, rezervacija ostaje |
| `costUsd: NaN` / `Infinity` | `unknown-cost`, rezervacija ostaje |
| `measured` nedostaje | `unknown-cost`, rezervacija ostaje |
| `ablation.json.costUsd: 0.277859` | validan |
| `ablation.json.costUsd` nedostaje / nije broj | `unknown-cost`, rezervacija ostaje |

- Test piše asistent, commit-uje ga sa autorom u poruci, test-lock; orkestrator ga izvršava i ne menja.
- Dodatno: suvi test wrappera (`final-run.sh`) na mock runu (`USE_MOCK=1`, $0) pre prvog plaćenog poziva.
- Dokaz pre Faze 3 (A3 §1): ablacija sa malim `BUDGET_USD` odbija poziv **pre** slanja (hard gate) — trošak $0.

## 4. Uticaj

- Faza 0 implementacija `final-budget.mjs` i `final-run.sh` uključuje ova pravila i testove.
- Ne menja 9 uslova, budžetsku tabelu, hardBudget fix, git sidrenje ni ranije odluke.

## 5. Lock v1.4 i runda 6

- novi lock sadrži sha256 za svih pet dokumenata (PREREG + A1..A4);
- runda 6: oba recenzenta potvrđuju da je P0 iz runde 5 zatvoren i da nema novih P0/P1; ako oba daju `AGREE`, plan je zaključan i start čeka odobrenje korisnika; ako ne, runde 7–10 po odobrenju korisnika.
