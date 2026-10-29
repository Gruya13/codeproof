# PREREG AMENDMENT 3 — hermetičko zatvaranje budžeta i manifesta

**Status: LOCKED v1.3** · datum 2026-10-29. · osnov: `PREREG.md` v1.0 + `AMENDMENT-1` (v1.1) + `AMENDMENT-2` (v1.2)
**Povod:** runda 4: **agy = AGREE WITH CONDITIONS**, **codex = DISAGREE** — ali **oba o istim tri stvarne rupe** (plus dve operativne dopune). Ovaj amendment ih zatvara; dogovor iz runde 2 ostaje na snazi.
**Odnos prema prethodnim fajlovima:** originalni plan i AMENDMENT-1/2 se **ne menjaju**; ovaj fajl je dopuna.

## 1. Hard budget u ablaciji (R4-CX-1 / R4-AG-1)

**Nalaz (oba potvrdila, dokaz u kodu):** `scripts/ablation.mjs:88-92` pravi `Budget` ali poziva `createAgents` **bez** `hardBudget`; `src/agents/index.mjs:139` aktivira preflight samo ako je `options.hardBudget` truthy. Zato `BUDGET_USD` u ablaciji **nije** dokazana gornja granica troška (soft cap prekoračenje = jedan poziv).

**Rešenje (Faza 0, pre Faze 3, pre freeze-a):**
- u `scripts/ablation.mjs` poziv `createAgents` dobija `hardBudget: config.hardBudget`;
- regresioni test: statički test koji pada bez te opcije + postojeći agents hard-budget test; test piše asistent, zaključava se test-lock-om, autor u commit poruci;
- dokaz pre Faze 3: `node scripts/ablation.mjs --repo bench/held-out` sa `BUDGET_USD` malim → poziv se odbija **pre** slanja (hard gate), trošak $0 za taj dokaz.
- Time je za ablaciju `reservedUsd = BUDGET_USD` (2 USD) **dokazana** gornja granica.

## 2. Settle za held-out iz `ablation.json` (R4-CX-2 / R4-AG-2)

`final-budget.mjs settle --attempt <n> --artifact <path>`:
- standardni run: čita `run.json.usage.costUsd`;
- **held-out: čita `ablation.json.costUsd` (korenska polja), status `ok`**; putanja polja je eksplicitna, nedostatak polja = `unknown-cost` (nikad tiho 0);
- proverava i da je `artifact` direktorijum koji stvarno sadrži `run.json` ili `ablation.json`; `runDir` se upisuje u manifest, `note` navodi odakle je trošak.

## 3. Trajno sidrenje pre svakog API poziva (R4-CX-3 / R4-AG-3)

`scripts/final-run.sh` — obavezni redosled po pokušaju:
1. `final-budget.mjs reserve --attempt <n> --block <b> --label <l> --max <BUDGET_USD>` → upis `reserved` reda i provera `spentEffective + max <= 40`;
2. **`git add reports/final/ATTEMPTS.jsonl` i `git commit -m "attempt <n>: reserved <max> USD"`** (`-c user.name/codef` autor fiksiran) — sidrenje **pre nego što se novac potroši**;
3. pokretanje runa;
4. `final-budget.mjs settle --attempt <n> --artifact <run dir>` → stvarni trošak/status;
5. na kraju bloka: `git add reports/final` + commit koji nosi artefakte i settle zapise.
- Posledica: brisanje poslednjeg reda manifesta ne briše trag — rezervacija je već u git istoriji; verifikator poredi git istoriju manifesta sa trenutnim stanjem.
- `audit` pre settle-a: popisuje sve `run.json`/`ablation.json` pod `reports/final` i poredi sa manifestom; svaki artefakt koji nije u manifestu ili nije sidren = **FAIL**.

## 4. Viseće rezervacije (R4-AG-4 / R4-CX-4)

- `check`/`reserve` pre nove rezervacije: ako postoji red sa `status: reserved|started` (prekinut ili u toku) → **abort** sa uputstvom; orkestrator mora prvo da ga razreši (`settle` stvarnim troškom iz API loga ili `unknown-cost` sa rezervacijom).
- Nema gomilanja rezervacija; nijedna rezervacija se ne briše.
- `spentEffective = Σ costUsd (settled) + Σ reservedUsd (reserved/started/unknown-cost)` — ledger nikad ne potcenjuje.

## 5. Uticaj na plan

- **Faza 0** dobija: (a) hardBudget fix u ablaciji + regresioni test, (b) implementaciju `scripts/final-budget.mjs` i `scripts/final-run.sh`, (c) suvi test wrappera na mock runu (`USE_MOCK=1`, $0) pre prvog pravog API poziva; sve commit-ovano pre Faze 1.
- **Faza 3** (held-out): pre runa proveriti da fix postoji; settle iz `ablation.json`.
- **Faza 5**: audit manifesta i git istorije ulazi u finalnu verifikaciju.
- Ukupan budžet i 9 uslova iz AMENDMENT-1/2 ostaju nepromenjeni.

## 6. Lock v1.3 i runda 5 (poslednja)

- novi lock sadrži sha256 za sva četiri dokumenta (PREREG + A1 + A2 + A3);
- runda 5 je **poslednja** po dogovoru sa korisnikom: oba recenzenta potvrđuju da su R4 nalazi zatvoreni i da nema novih P0/P1; ako oba daju `AGREE`, plan je zaključan i start čeka samo odobrenje korisnika; ako ne, eskalira se korisniku (5/5 rundi).
