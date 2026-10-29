# PREREG AMENDMENT 2 — zatvaranje nalaza iz runde 3

**Status: LOCKED v1.2** · datum 2026-10-29. · osnov: `PREREG.md` v1.0 + `PREREG-AMENDMENT-1.md` (v1.1)
**Povod:** runda 3 potvrde amendmenta v1.1: **agy = AGREE** (nema nalaza), **codex = DISAGREE** sa 3 nalaza (R3-CX-A..C) i jednom dopunom (D). Ovaj amendment ih zatvara; dogovor iz runde 2 ostaje na snazi.
**Odnos prema prethodnim fajlovima:** originalni plan i AMENDMENT-1 se **ne menjaju**; ovaj fajl je dopuna koja se čita zajedno sa njima.

## 1. R3-CX-A (P1) — konkretne score komande (menja PREREG §4.4 i AMENDMENT-1 uslov 2)

Komanda za skoriranje **nikad** ne dobija parent `--out` direktorijum i nikad ne bira „latest":

```bash
score_run() {
  OUT="$1"
  N=$(find "$OUT" -mindepth 1 -maxdepth 1 -type d | wc -l)
  [ "$N" -eq 1 ] || { echo "ABORT: $OUT has $N run dirs (expected exactly 1)"; exit 1; }
  RUN=$(find "$OUT" -mindepth 1 -maxdepth 1 -type d)
  node bench/score.mjs --run "$RUN"
}
score_run reports/final/bench-calibration/single-1
score_run reports/final/bench-calibration/single-2
score_run reports/final/bench-calibration/dual
```

Extended (isti princip; run dir je `<out>/<runId>`):

```bash
score_injected_dir() {
  OUT="$1"
  N=$(find "$OUT" -mindepth 1 -maxdepth 1 -type d | wc -l)
  [ "$N" -eq 1 ] || { echo "ABORT: $OUT has $N run dirs"; exit 1; }
  node scripts/score-injected.mjs --expected bench/extended/expected.json --run "$(find "$OUT" -mindepth 1 -maxdepth 1 -type d)"
}
score_injected_dir reports/final/bench-extended/single
score_injected_dir reports/final/bench-extended/chunked
```

- Komanda `node bench/score.mjs --run reports/final/bench-calibration/single-1` iz PREREG §4.4 **je zamenjena** ovim pravilom.
- Abort ako u `<out>` nije tačno jedan run direktorijum. Zabranjeni: „latest", `ls -t | head`, ručno biranje.

## 2. R3-CX-B (P1) — jsesc rekonstrukcija sa commit korakom (menja AMENDMENT-1 uslov 4)

- Javni izvor: `https://github.com/mathiasbynens/jsesc`, pin `819f534875fd87c9033bb72148ab6a6ad1219ca0` (v3.1.0).
- **Scope za run je direktorijum `analysis-target`** (ne fajl). Rekonstrukcija mora da uključi commit, jer ingest čita sadržaj iz analiziranog commita (`src/ingest/index.mjs` — `readFileAtCommit`):

```bash
git clone https://github.com/mathiasbynens/jsesc.git jsesc-regression
git -C jsesc-regression checkout 819f534875fd87c9033bb72148ab6a6ad1219ca0
mkdir -p jsesc-regression/analysis-target
cp jsesc-regression/jsesc.js jsesc-regression/analysis-target/jsesc.js
git -C jsesc-regression add analysis-target/jsesc.js
git -C jsesc-regression -c user.name=codeproof -c user.email=codeproof@local commit -m "analysis scope: jsesc.js"
git -C jsesc-regression rev-parse HEAD          # SHA se upisuje u REALWORLD-CANDIDATES.lock.json
sha256sum jsesc-regression/analysis-target/jsesc.js
# očekivano: 03c367cbd13dc753bb8fc6c8ec3a01078c3ee142ee3f747c0490d311bc80a3b3
```

- Pre svakog regresionog jsesc runa obavezne provere: `git -C <clone> rev-parse HEAD` = zabeleženi SHA **i** `git -C <clone> status --porcelain -- analysis-target` prazan (dirty=false).
- Postojeći lokalni klon `real-world/jsesc` (commit `e3349b5`) je validan izvor **ako** te dve provere prođu; u suprotnom se koristi gornja rekonstrukcija.
- Picomatch: `--repo https://github.com/micromatch/picomatch --commit 6bb40679c218cefba5d4e9662408c5fdf699a8bb --scope lib` — javni pin, bez lokalnih zavisnosti.

## 3. R3-CX-C (P0) — budžetska rezervacija za nepoznat trošak (menja AMENDMENT-1 uslove 7 i 8)

**Problem:** ako API poziv naplati tokenе a run padne pre nego što napiše `run.json`, ledger koji sabira samo `run.json` ne vidi taj trošak → stvarni zbir može preći $40.

**Rešenje — rezervacija pre poziva, settle posle:**

1. **Pre svakog API runa:** `node scripts/final-budget.mjs reserve --attempt <n> --max <BUDGET_USD>` upisuje u `ATTEMPTS.jsonl` red `{attemptNo, block, label, startedAt, status:"reserved", reservedUsd:<BUDGET_USD>, costUsd:null, runDir:null}`; pre upisa proverava `spentEffective + reservedUsd <= 40`, inače abort.
2. **Posle runa:** `settle --attempt <n>`:
   - ako je `run.json` nastao → `costUsd = run.json.usage.costUsd`, `status:"ok"|"failed"`, `runDir` popunjen;
   - ako `run.json` **nije** nastao → `status:"unknown-cost"`, `costUsd:null`, **`reservedUsd` ostaje u obračunu** dok se stvarni trošak ne unese ručno iz API poziva/loga; nikad se ne briše i nikad se ne procenjuje na nulu.
3. **`spentEffective = Σ costUsd (settled) + Σ reservedUsd (open/unknown-cost)** — ledger **nikad ne potcenjuje**.
4. `check --next-max <usd>`: `spentEffective + next-max <= 40`, inače abort; ako `spentEffective >= 35` → stop runde (osim rezerve za re-run posle fixa, uz zapis u amendment).
5. `run.json` i `ATTEMPTS.jsonl` se ne sabiraju dvaput: jedan pokušaj = jedan red u manifestu; `run.json` služi samo za settle tog reda.

## 4. R3-CX-D (P1) — manifest pokušaja (menja AMENDMENT-1 uslov 8)

`reports/final/ATTEMPTS.jsonl`, jedan JSON objekat po redu, polja:
`attemptNo` (inkrementalni 1,2,3… bez rupa), `block`, `label`, `startedAt`, `endedAt` (null dok traje), `status` (`reserved|started|ok|failed|aborted|unknown-cost`), `reservedUsd`, `costUsd` (null dok nepoznat), `runDir` (ili null), `note`.
- Brisanje reda stvara rupu u numeraciji → verifikator prijavljuje FAIL.
- `runId` nije ključ pokušaja (kolizija istog runId na istoj reviziji); dedup samo po sha256 sadržaja `run.json`.
- Manifest je jedini izvor istine za zbir; `run.json` daje tačan iznos po pokušaju.

## 5. Ostalo

- **agy (runda 3):** nema nalaza, `AGREE` — dogovor iz runde 2 nije oslabljen.
- **Uređivačka ispravka:** referenca „Komande u §2" iz AMENDMENT-1 uslova 2 odnosi se na **§1 ovog amendmenta** (u AMENDMENT-1 §2 je budžetska tabela).
- Implementacija `scripts/final-budget.mjs` i `scripts/final-run.sh` je deo Faze 0, **pre prvog API poziva**; njihov izlaz se commit-uje pre Faze 1.

## 6. Lock v1.2 i runda 4

- novi lock sadrži sha256 za `PREREG.md` (nepromenjen), `AMENDMENT-1` (nepromenjen) i ovaj fajl;
- runda 4 potvrde: codex proverava da su R3-CX-A..D rešeni, agy proverava da dogovor nije oslabljen; ako oba daju `AGREE`, runda može da počne posle odobrenja korisnika.
