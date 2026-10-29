# PREREG AMENDMENT 1 — posle nezavisne recenzije plana

**Status: LOCKED v1.1** · datum 2026-10-29. · osnov: `PREREG.md` v1.0 (sha256 `209b1318…f2f8fed9`)
**Povod:** nezavisna recenzija plana u dve niti — **agy-verify** i **codex-verify** (2 runde, 29.10.2026, slepi ulaz, bez API poziva).
**Zaključak recenzije:** oba recenzenta daju **AGREE WITH CONDITIONS** na **zajedničkoj listi od 9 uslova**:
- runda 1: codex `DISAGREE` (CX-1…CX-7), agy `AGREE WITH CONDITIONS` (AG-1…AG-7, 5 uslova);
- runda 2 (razmena nalaza): codex prelazi na `AGREE WITH CONDITIONS` sa listom od 9; agy prihvata svih 9 („DA, u potpunosti se slažem sa drugim recenzentom").
**Odnos prema originalu:** `PREREG.md` se **ne menja** — ovaj amendment je jedini izvor promena i čita se zajedno sa originalom.
**Start:** izvršavanje ne počinje dok ovaj amendment ne bude zaključan (lock v1.1) **i** potvrđen od oba recenzenta (§5).

## 1. Devet obavezujućih uslova (dogovoreno jednoglasno)

| # | Uslov | Kako se primenjuje | Gde |
|---|---|---|---|
| 1 | Klonovi pod `reports/final/` ne smeju u git | u `.gitignore` dodato `reports/final/**/_repo/` (ovaj amendment); pre Faze 1 provera `git check-ignore -q reports/final/real-world/example/_repo/file.js` = exit 0; posle svake faze `git status --porcelain` čist | `.gitignore`, Faza 0/5 |
| 2 | Tačne score putanje (bez „latest") | svaki pokušaj ima svoj `--out` direktorijum; run nastaje u `<out>/<runId>` (`src/cli.mjs` — `resolve(args.out, runId)`); score gađa **taj** dir; ako u `<out>` nije tačno 1 run dir → abort. Komande u §2 | §4.4, Faza 3 |
| 3 | `ablation.json` je dokazni izuzetak | za held-out važi `ablation.json` (+ `ABLATION.md`) sa `costUsd`; ulazi u finalni manifest i zbir troška; izuzetak od pravila „brojevi iz `run.json`" je eksplicitan | §10.1, DoD 5 |
| 4 | Ponovljiv izvor za regresioni par | **picomatch:** `https://github.com/micromatch/picomatch`, pin `6bb40679c218cefba5d4e9662408c5fdf699a8bb` (tag 4.0.7), scope `lib`; **jsesc:** `https://github.com/mathiasbynens/jsesc`, pin `819f534875fd87c9033bb72148ab6a6ad1219ca0` (v3.1.0), scope = fajl `jsesc.js`; rekonstrukcija: klon + `mkdir analysis-target && cp jsesc.js analysis-target/jsesc.js`; sha256 sadržaja `03c367cbd13dc753bb8fc6c8ec3a01078c3ee142ee3f747c0490d311bc80a3b3` (bajt-identičan upstreamu, provereno); lokalni commit `e3349b5` se tom prilikom dokumentuje. Nijedan run ne zavisi od nedokumentovanog foldera. | §4.5 |
| 5 | Zamrznut extended `_repo` | lokalni klon `reports/probes/real/axios-extended/_repo` je zamrznut na `b2c8f4c90801b6c2260a43ce7550c22868a0fb82`; **zabranjeno** brisanje i rekonstrukcija preko `make-injected.mjs` (menja SHA i prlja frozen putanju); pre Faze 3 obavezna provera `git -C ... rev-parse HEAD`; ako nije taj SHA — extended se ne meri i to se prijavljuje | §4.4 |
| 6 | Pre-lock real-world kandidata + razdvajanje metrika | pre Faze 4 zaključati `reports/final/REALWORLD-CANDIDATES.lock.json` (5 kandidata, commitovi, scope, redosled zamena, svi dry-run ishodi); početna lista: `mustache`, `fast-json-patch`, `bcryptjs`, `sax`, `argparse`; zamene: `dateformat`, `accounting`, `uuid`; DoD strogo razdvaja nove repoe od regresionih i bench dokaza; 0-nalaza i opovrgnuti nalazi ostaju u tabeli | §4.5, DoD 7 |
| 7 | Zbirni budžetski ledger i izvršni stop | `reports/final/ATTEMPTS.jsonl` + `scripts/final-budget.mjs` (suma svih `run.json` + manifesta, `check --next-max <usd>`) + `scripts/final-run.sh` (provera → pokretanje → upis pokušaja); **svi runovi pojedinačno** (`--runs 1`), nikad `--runs 2` u jednom pozivu; capovi blokova u §2; stop na $35; implementirati u Fazi 0 pre prvog API runa | Faza 0, §5 |
| 8 | Manifest svih pokušaja | `ATTEMPTS.jsonl` polja: `attemptNo, block, label, startedAt, endedAt, status, costUsd, runDir, note`; upisuje se i pokušaj koji stane pre `run.json`; `runId` **nije** ključ pokušaja (kolizija na istoj reviziji); dedup po sha256 sadržaja, ne po runId | Faza 0, §10 |
| 9 | Puna deterministička provera posle freeze-a | Faza 5: na tagu `v0.2.3-final` ponoviti i zapisati u `reports/final/F5-baseline.md`: testovi Node 22/26, `make integrity`, `make replay`, `make score`, `make demo`, clean-clone (tmpfs) **i** Docker `node:22-alpine`; ako Docker nije dostupan — prijaviti „nije provereno", nikad lažni PASS | Faza 5 |

## 2. Revidirani budžet — zbir capova = $40

| Blok | Runova | Cap |
|---|---:|---:|
| F1 dogfood chunked + single | 2 | $6 |
| F3 kalibracioni single ×2 | 2 | $4 |
| F3 kalibracioni dual ×1 | 1 | $3 |
| F3 extended chunked + single | 2 | $5 |
| F3 held-out ablacija | 1 | $1 |
| F4 novi real-world 5 × 2 | 10 | $10 |
| F4 regresija picomatch + jsesc | 2 | $2 |
| F4 dual jsesc | 1 | $2 |
| **Core** | **21** | **$33** |
| Opcije (three-way, controlled, istorijski recall) | ~5 | $2 |
| Rezerva (retry/re-run posle fixa) | — | $5 |
| **Ukupno = hard cap** | | **$40** |

**Cilj: $35.** Pravilo (uslov 7): pre svakog runa `node scripts/final-budget.mjs check --next-max <gornja cena runa>`; run se ne pokreće ako bi `spent + next-max > 40`; kada `spent ≥ 35` runda staje (osim rezerve za re-run posle dogfood/freeze popravke, uz zapis u amendment). Per-run `BUDGET_USD` ostaje 2,5–5 kako je u originalnom planu.

## 3. Ispravka baseline troška (nalaz provere iz recenzije)

- Do sada potrošeno: **$55,8970** (svi `run.json` na disku, dedup po sha256, 104 unique) odnosno **$50,3643** za gitom praćene (82 fajla, 76 unique).
- Broj **$42,4571 iz lock-a v1.0 bio je pogrešan**: dedup po `runId` spajao je različite pokušaje istog runId (npr. picomatch run 1 i run 2). Ispravljeno ovde — to je isti rizik koji pokriva uslov 8 (`runId` nije ključ pokušaja).
- Ovo ne menja cap runde ($40 za rundu je nezavisan), ali ispravlja evidenciju pre prvog runa.

## 4. Preciziranja iz recenzije (prihvaćena, van 9 uslova)

- **AG-1:** klonovi pod `reports/final/` ruše `clean-clone` i Fazu 5 (zahtev za čist `git status`), ali ne `integrity.mjs` direktno (ne proverava `reports/final/`) — precizirano.
- **AG-4:** `jsesc/analysis-target` je commitovan u lokalnom commitu `e3349b5` i stari jsesc runovi imaju `dirty=false`; problem je portabilnost — rešen uslovom 4.
- **AG-6:** 0-nalaza na **novim** repoima ostaje prijavljen neuspeh za nove repoe i ne maskira se regresionim parom.
- **CX-4:** Faza 5 sada ponavlja pun DoD 2 kontrolni set (uslov 9).
- Tvrdnja „nijedan API poziv pre lock-a" nije nezavisno dokaziva — ostaje tvrdnja orkestratora, potvrđena lokalnom istorijom (u ovoj sesiji nema API poziva).
- Docker clean-clone može zahtevati sudo/grupu; ako nije dostupan — „nije provereno", bez lažnog PASS-a.

## 5. Uslov za početak izvršavanja

1. ovaj amendment + lock v1.1;
2. **runda 3 recenzije:** oba recenzenta daju `AGREE` na primenu lista u ovom amendmentu; ako neko traži izmenu → `PREREG-AMENDMENT-2.md` i ponovni dogovor (ukupno max 5 rundi);
3. eksplicitno odobrenje korisnika za start;
4. prvi API poziv je dozvoljen tek posle 1–3.
