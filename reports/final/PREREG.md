# PREREG — poslednja runda testiranja (bench + dogfood + real world)

**Status: LOCKED v1.0** · zaključan 2026-10-29. · autor: DSH orkestrator (uz odobrenje korisnika)
**Lock zapis:** `reports/final/PREREG.lock.json` (sha256 ovog fajla, git HEAD, vreme, baseline).
**Izvršenje: NIJE POČELO.** Runda startuje tek na eksplicitno odobrenje; prvi korak posle odobrenja je commit ovog fajla + lock-a (dokaz da je prereg pre prvog runa), pa Faza 0.
**Jezik:** interni operativni dokument (srpski); javni dokazi i README ostaju na engleskom.

## 0. Zaključane odluke korisnika (29.10.2026.)

| # | Odluka |
|---|---|
| 1 | Novi runovi idu u `reports/final/`; `reports/golden/` ostaje netaknut (frozen evidence, integrity baseline `2040aa9`). |
| 2 | Dogfood: oba režima — chunked + single. |
| 3 | Real world: 5 novih repoa + 2 regresiona (picomatch, jsesc). |
| 4 | Dual-scan uključen: kalibracioni bench (1 run) + jsesc (1 run). |
| 5 | Cilj **$35**, hard cap **$40**. |
| 6 | Snimanje: sirovi materijal tokom runde (samo posle freeze-a), finalni scenario/naracija/montaža posle runde. |

## 1. Polazno stanje (provereno 29.10.2026. pre lock-a)

| Stavka | Vrednost | Dokaz |
|---|---|---|
| Revizija | `dde6e58` (v0.2.2 + paket F), `main = origin/main`, stablo čisto | `git status -sb` |
| Deterministički | **241/241** (Node 26.8.2), 36 test fajlova | `make test` |
| Integrity | **PASS, 22 checks**, baseline `2040aa9`, test-lock OK | `node scripts/integrity.mjs` |
| Replay / score | 9/9; golden PASS | `make replay`, `make score RUN=reports/golden` |
| Javna dokumentacija | README tvrdi **234/234** → stale, stvarno 241/241 | `codeproof/README.md:52`, korenski `README.md` |
| Do sada potrošeno | **≈$42,46** API (dedup 98 `run.json`) | suma `usage.costUsd` po `reports/**` |
| Starost dokaza | golden 27.10. (pre v0.2.0), extended 28.10. (pre L4), dogfood `@25c2a26`, real-world sample 28.10. (pre hardeninga A–F); `REPORT.html` nijedan pravi run | `reports/v0.2.0/`, `reports/golden/` |

**Cilj runde:** svi headline brojevi sveži, na finalnom kodu, sa istim, poštenim protokolom.

## 2. Principi (obavezujući)

1. **Prereg.** Ovaj plan je zaključan pre prvog runa; izmene samo kroz amendment (§10.4).
2. **Dogfood prvi.** Ako dogfood nađe stvarni defekt, popravka + regresioni test idu pre zamrzavanja i pre bench/real-world merenja.
3. **Zamrzavanje pa merenje.** Sva bench/real-world merenja idu na tagovanu reviziju `v0.2.3-final`; posle zamrzavanja menja se samo dokumentacija (izuzetak: P0 bug u alatu, uz amendment i re-run pogođenih stavki).
4. **Svi pokušaji se prijavljuju** — uključujući truncation/retry/abort/neuspele runove; nijedan run se ne odbacuje iz evidencije.
5. **Brojevi samo iz `run.json`.** Nijedan broj se ručno ne prepisuje.
6. **Hand-check svakog objavljenog real-world nalaza** (potvrđen/opovrgnut/latentan + težina + način provere).
7. **Nezavisna verifikacija** pre upisa finalnih brojeva: agy-verify (slepi ulaz) + codex-verify (WATCHDOG: test-lock hash + git revizija).
8. **Nema tuninga posle prvog runa** (ni promptova ni setova); kalibracija je već zamrznuta.

## 3. Redosled faza

| Faza | Sadržaj | Zavisnost | API |
|---|---|---|---|
| 0 | Deterministički kontrolni sloj (Node 22/26, integrity, replay, score, demo, clean-clone + docker) | — | $0 |
| 1 | Dogfood (chunked + single) → adjudikacija → popravke + regresioni testovi | Faza 0 | ~$4,5 |
| 2 | Zamrzavanje: commit + tag `v0.2.3-final`; zapis revizije | Faza 1 | $0 |
| 3 | Bench: kalibracioni single ×2 + dual ×1; extended chunked + single; held-out ablacija | Faza 2 | ~$8,2 |
| 4 | Real world: 5 novih ×2 + regresija (picomatch, jsesc) + dual jsesc; hand-check | Faza 2 | ~$10,0 |
| 5 | Objava: `reports/final/README.md`, README/STATUS sync, verifikacija, push, snimci | Faza 3,4 | $0 |

## 4. Plan po fazama

### 4.1 Faza 0 — deterministički kontrolni sloj ($0)

Komande (redom, sve mora PASS), iz `codeproof/`:

```
make test                                   # Node 26: 241/241
mise exec node@22.23.3 -- make test        # Node 22: 241/241
node scripts/integrity.mjs                  # PASS 22
make replay                                 # 9/9
make score RUN=reports/golden               # PASS
make demo                                   # MOCK MODE prolazi
make clean-clone                            # tmpfs + env -i
make clean-clone-docker                     # node:22-alpine
```

Izlaz: `reports/final/F0-baseline.md` (tačni brojevi, vremena, revizija).

### 4.2 Faza 1 — dogfood (~$4,5)

Cilj: CodeProof na sopstvenom `src/` (22 fajla / 4.879 LOC @ pre-popravke `dde6e58`).

```
BUDGET_USD=4 CHUNKED_SCAN=1 node src/cli.mjs analyze src --mode smoke --out reports/final/self-analysis/chunked --allow-output-in-target
BUDGET_USD=3 node src/cli.mjs analyze src --mode smoke --out reports/final/self-analysis/single --allow-output-in-target
```

Proces: ručna adjudikacija svakog proposed nalaza (stvarno/latentno/namerno/lažno) → za svaki stvarni: fix + regresioni test (test-lock, autor u commit poruci) → ponovni `make test`/`integrity` → ponovni dogfood run ako je fix menjao analizirani kod (iz rezerve).
Očekivanje (ne obaveza): istorijski chunked 11 proposed → 9 verified / 3 exec / 2 patch-proven; single 3/3.
Izlaz: `reports/final/self-analysis/` + `HAND-CHECK.md` + popravke.

### 4.3 Faza 2 — zamrzavanje

- commit svih dogfood popravki i artefakata; tag `v0.2.3-final`;
- `reports/final/FREEZE.json`: revizija, datum, `make test` broj, hash `src/`;
- od ovog trenutka mere se bench i real-world; kod se ne menja do kraja runde.

### 4.4 Faza 3 — bench (~$8,2)

**Kalibracioni** (`bench/seed-repo`, 15 f./229 LOC, 8+4, frozen):

```
BUDGET_USD=2.5 MAX_FINDINGS=12 node src/cli.mjs analyze bench/seed-repo --mode bench --out reports/final/bench-calibration/single-1
node bench/score.mjs --run reports/final/bench-calibration/single-1
BUDGET_USD=2.5 MAX_FINDINGS=12 node src/cli.mjs analyze bench/seed-repo --mode bench --out reports/final/bench-calibration/single-2
BUDGET_USD=4 DUAL_SCAN=1 MAX_FINDINGS=12 node src/cli.mjs analyze bench/seed-repo --mode bench --out reports/final/bench-calibration/dual
```

Prijavljuju se oba single runa i dual run (varijansa se ne skriva).

**Extended** (`bench/extended`, axios `lib/` 74 f./9.564 LOC, 16+5, frozen):

```
BUDGET_USD=4 node src/cli.mjs analyze reports/probes/real/axios-extended/_repo/lib --mode smoke --out reports/final/bench-extended/single
BUDGET_USD=5 CHUNKED_SCAN=1 node src/cli.mjs analyze reports/probes/real/axios-extended/_repo/lib --mode smoke --out reports/final/bench-extended/chunked
node scripts/score-injected.mjs --expected bench/extended/expected.json --run <dir>
```

(`_repo` postoji lokalno; ako nedostaje, rekonstruisati preko `scripts/make-injected.mjs` — mreža, bez API troška.)

**Held-out** (`bench/held-out`, 6+4, frozen; nije korišćen za tuning):

```
BUDGET_USD=2 node scripts/ablation.mjs --repo bench/held-out --out reports/final/bench-heldout
```

### 4.5 Faza 4 — real world (~$10)

Kriterijumi za nove repoe: CJS ili ESM sa eksplicitnim ekstenzijama (L3/L4 izvršiv), **bez runtime zavisnosti**, 300–3.000 LOC, javni pinovan commit, nije korišćen u ranijim rundama.
Kandidati (5 se bira posle dry-run-a; zamena kandidata ne menja obim ni cenu):
`mustache`, `fast-json-patch`, `bcryptjs`, `sax`, `argparse` (fallback: `dateformat`, `accounting`, `uuid`).

Pre trošenja: `node scripts/probe-repo.mjs --repo <url> --scope <dir> --dry-run` za svih 5 (meri fajlove/LOC/prompt cap; $0).

Runovi (2 po repou):

```
BUDGET_USD=4 node scripts/probe-repo.mjs --repo <url> --commit <sha> --scope <dir> --runs 2 --mode smoke --tag <name> --out reports/final/real-world/<name>
```

Regresioni par (1 run svaki, isti pinovi kao v0.2.2):

```
BUDGET_USD=4 node scripts/probe-repo.mjs --workdir ../real-world/picomatch --scope lib --runs 1 --mode smoke --tag picomatch --out reports/final/real-world/picomatch-regression
BUDGET_USD=4 node scripts/probe-repo.mjs --workdir ../real-world/jsesc --scope analysis-target --runs 1 --mode smoke --tag jsesc --out reports/final/real-world/jsesc-regression
```

Dual na malom realnom kodu:

```
BUDGET_USD=4 DUAL_SCAN=1 node scripts/probe-repo.mjs --workdir ../real-world/jsesc --scope analysis-target --runs 1 --mode smoke --tag jsesc-dual --out reports/final/real-world/jsesc-dual
```

Hand-check: svaki published nalaz → `HAND-CHECK.md` u run direktorijumu (status, težina, način provere, upstream link ako postoji).

### 4.6 Faza 5 — objava ($0)

- `reports/final/README.md` — finalne tabele (bench, extended, held-out, dogfood, real-world, dual) sa run-id, cenom, brojem pokušaja;
- `codeproof/README.md` + korenski `README.md`: sveži brojevi i test count (234 → 241+), sekcija "Final evaluation (2026-10-30)", golden opisan kao istorijski (27.10.) i netaknut;
- `STATUS.md` unos za dan runde;
- `make test`/`integrity`/`replay` finalno; `git status` čist; push;
- snimci: sirovi materijal iz Faze 1–4 se arhivira u `reports/final/captures/` (tekstualni logovi) — video fajlovi ostaju van repoa.

## 5. Budžet i kontrola

| Blok | Runova | Procena | Cap bloka |
|---|---:|---:|---:|
| F0 deterministički | 0 API | $0 | $0 |
| F1 dogfood chunked + single | 2 | $4,5 | $6 |
| F3 bench kalibracioni single ×2 | 2 | $2,2 | $4 |
| F3 bench kalibracioni dual ×1 | 1 | $1,8 | $3 |
| F3 extended chunked + single | 2 | $3,8 | $5 |
| F3 held-out | 1 | $0,4 | $1 |
| F4 real world 5 × 2 | 10 | $7,5 | $10 |
| F4 regresija picomatch + jsesc | 2 | $1,5 | $2 |
| F4 dual jsesc | 1 | $1,0 | $2 |
| **Core** | **21** | **$22,7** | **$33** |
| Opcije (three-way, controlled, istorijski recall) | ~5 | $2,0 | $3 |
| Rezerva (retry/truncation/re-run posle fixa) | — | $5,0 | $7 |
| **Ukupno** | | **~$29,7** | — |
| **Cilj / hard cap** | | **$35 / $40** | |

Kontrola: per-run `BUDGET_USD` kako je navedeno; trošak se sabira iz `run.json` posle svake faze.
**Stop-loss:** pre Faze 4 provera sume — ako je >$25, real world se svodi na 4 nova repoa (ne 5); ako ukupna suma dostigne **$35**, runda se zaustavlja (osim rezerve za re-run posle dogfood/freeze popravke, i to uz zapis u amendment-u). Hard cap **$40** se ne prelazi ni pod kojim uslovom.

## 6. Definicija uspeha (DoD)

1. Svaki headline broj u README-u ima svež artefakt u `reports/final/` (revizija, datum, run-id, cena, broj pokušaja).
2. Deterministički: ≥241/241 na Node 22/26, integrity PASS, replay 9/9, score PASS, demo, clean-clone (tmpfs + docker) — sveže posle freeze-a.
3. Kalibracioni: 2 single runa prijavljena; očekivano 8/8 + 0/4 trapova + svi execution/patch-proven; dual run prijavljen sa per-scanner statusom i cross-verifikacijom. Ako brojevi padnu — prijaviti pošteno i navesti varijansu.
4. Extended: chunked 9–10/16, single 4–7/16, 0/5 trapova; oba scored.
5. Held-out: 5–6/6, 0 trapova, sva 4 nivoa ablacije.
6. Dogfood: 0 neadjudikovanih nalaza; svi stvarni popravljeni sa regresionim testom; ako nema nalaza — i to je rezultat.
7. Real world: ≥1 execution-proven i ≥1 patch-proven na novim repoima; svi published ručno adjudikovani; 0 lažnih posle hand-checka; 0-nalaza repoi prijavljeni kao takvi; regresioni par dokazuje da L3/L4 rade isto kao pre hardeninga.
8. Nezavisna verifikacija: agy-verify slepo potvrdio sve brojeve; codex-verify **WATCHDOG OK** (hash + git revizija).
9. `reports/golden/` i ostali frozen artefakti netaknuti (integrity PASS).
10. README/STATUS bez stale brojeva; korenski i javni README sinhronizovani.

## 7. Rizici i kill-kriterijumi

| Rizik | Verovatnoća | Mitigacija |
|---|---|---|
| dogfood nađe defekt → kašnjenje | srednja | faza je prva; rezerva $7 i 1 dan (do 1.11.) |
| truncation/retry podigne cenu (videno: marked $2,18, picomatch $1,53) | srednja | procene +30%; per-run cap; stop-loss |
| real-world 0 nalaza | srednja | pošteno prijaviti; regresioni par nosi dokaz L3/L4; promptovi se ne diraju |
| dual degradira (Wonder scan ne stane) | niska na malim metama | dual samo na kalibracionom (229 LOC) i jsesc (337 LOC) |
| L3/L4 padne posle hardeninga | niska | regresioni par + replay; ako padne → P0 fix + amendment + re-run iz rezerve |
| prekoračenje vremena pre videa (2–3.11.) | niska | runda se zatvara 1.11.; video koristi gotove artefakte |
| lažna ušteda — preskakanje runa | — | svaki preskočen run je eksplicitan u `reports/final/README.md` |

## 8. Snimanje — hibridna politika

- **Tokom runde (posle freeze-a):** sirovi materijal — terminal snimci runova (dogfood chunked, extended chunked, bench), `REPORT.html` u browseru, replay bez ključa, real-world nalaz. OBS/ffmpeg su dostupni; tekstualni logovi runova se arhiviraju u `reports/final/captures/`.
- **Posle runde:** finalni scenario (3 min), selekcija kadrova, naracija, montaža, `ffprobe` ≤180 s. Scenario zavisi od finalnih brojeva i najjačeg nalaza — zato posle.
- Pravila: snima se samo kod sa `v0.2.3-final`; maskirani `.env`/ključevi; svaki kadar nosi stvarni run-id iz `reports/final/`; mock kadar nikad kao stvarni run.

## 9. Ograničenja — šta runda ne dokazuje

- L3/L4 dokazi (`execution-proven`/`patch-proven`) postoje samo na Node 26.8.2 (LinkCheck zahteva `--allow-inspector`); na Node 22 isti run daje `link-unproven` i nalaz ostaje `verified`.
- L3/L4 rade samo za kod koji je direktno izvršiv (CJS ili ESM sa eksplicitnim ekstenzijama, bez spoljnih zavisnosti); ostalo je `repro-unavailable`.
- Izolacija je procesna (`node --permission`), ne OS-level.
- Kalibracioni set je n=8 i korišćen je za kalibraciju — nije statistička tvrdnja.
- Real-world rezultati su anegdote (mali n, javni commitovi → kontaminacija moguća).
- Model izlaz nije bit-determinističan → broj pokušaja se uvek navodi.
- Replay dokazuje da je zapis nepromenjen i da mehaničke kapije i dalje prolaze; ne dokazuje semantički sud L2.

## 10. Protokol dokaza

### 10.1 Artefakti po runu
Svaki run čuva verbatim: `run.json`, `findings.json`, `REPORT.md`, `REPORT.html`, `rejected.md`, `candidates.json`, `repro/`, `patch/`. Commit u `reports/final/<blok>/<run>`.

### 10.2 Hand-check
`HAND-CHECK.md` po real-world repou: za svaki published nalaz — status (potvrđen/opovrgnut/latentan/pogrešna težina), način provere (čitanje koda / izvršavanje malog repro-a / upstream issue), i konačna ocena.

### 10.3 Nezavisna verifikacija
- **agy-verify** (slepi ulaz: spec + artefakti + tvrdnje, bez mog reasoninga) proverava svaki finalni broj i da nema cherry-picka;
- **codex-verify** radi watchdog: `git show <rev>:<rel>` hashovan u lock (`test-lock`), integrity PASS;
- nijedan model ne verifikuje sopstveni rad.

### 10.4 Izmene plana (amendment)
Posle lock-a ovaj fajl se **ne menja**. Svaka izmena ide u `reports/final/PREREG-AMENDMENT-<n>.md` (datum, razlog, šta se menja, uticaj na budžet) i novi `PREREG.lock.json` hash. Original ostaje netaknut — isti princip kao test-lock.

## 11. Lock zapis

- `sha256` ovog fajla zapisan u `reports/final/PREREG.lock.json` zajedno sa vremenom, git HEAD-om (`dde6e58`), baseline brojevima i do-sada potrošenim iznosom;
- lock je napravljen **pre prvog API poziva**; prvi commit posle odobrenja sadrži PREREG + lock (dokaz redosleda);
- ako se hash ne poklapa → plan je menjan posle lock-a (UNPROVEN), runda se ne prihvata dok se ne razreši.
