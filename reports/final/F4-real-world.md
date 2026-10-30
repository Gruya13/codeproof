# F4 — real world (finalna runda)

**Datum:** 2026-10-29/30. (22:40–01:15 CET) · **Kod:** tag `v0.2.3-final` (`src` tree `f874d642`)
**Izvršilac:** DSH orkestrator, svi runovi kroz `scripts/final-run.sh` (reserve → git sidrenje → run → settle).
**Potrošeno F4:** **$6,9050** od planiranih $10.

## 1. Izbor kandidata (pre trošenja — `REALWORLD-CANDIDATES.lock.json`, commit `638f7bd`)

5 izabranih (od 8 dry-run kandidata), svi CJS/ESM, bez runtime zavisnosti, 300–3000 LOC, pinovan commit:

| Repo | Pin | Scope | Fajlovi/LOC | Rezultat (2 runa) | Cena |
|---|---|---|---|---|---|
| mustache | `972fd2b2` | `. ` | 80 / 2402 | 3 verified unosa (**2 defekta**) | $0,8823 |
| sax | `961ceeef` | `lib` | 1 / 1866 | 4 unosa (**2 stvarna**, 1 odbačen, 1 latentan) | $1,1172 |
| fast-json-patch | `9d313ac0` | `commonjs` | 3 / 803 | 4 unosa (**4 defekta**) | $0,7511 |
| bcryptjs | `1211e9a2` | `. ` | 11 / 1666 | 5 unosa (**3 defekta, 2 patch-proven**) | $1,3095 |
| dateformat | `e6800aa9` | `. ` | 43 / 2085 | 2 unosa (**1 defekt**; run1 0 nalaza) | $0,2662 |

**Odbačeni dry-run kandidati (prijavljeni, $0):** argparse 4892 LOC i accounting 6483 LOC (>3000 po PREREG §4.5); uuid — TS izvor bez commitovanog JS izlaza. Zamena: **dateformat** (kandidat #4 po planu zamena).

## 2. Regresioni par (isti pinovi kao v0.2.2; A1 uslov 4 / A2 §2)

| Meta | Pin | Run | Rezultat | Cena |
|---|---|---|---|---|
| picomatch | `6bb40679…` | `14ba4cc9` | 1 verified **patch-proven** | $0,5465 |
| jsesc | `e3349b54…` (sha256 `03c367cb…`) | `ea5b1ae7` | 2 verified (**1 patch-proven**) + 1 verified (mrtav kod) + 1 uncertain | $0,6289 |
| jsesc dual | isti | `1e1b03c5` | 2 verified **patch-proven** (1 root cause), spark 1 / wonder 1 | $1,4033 |

**Regresija potvrđena:** L3/L4 rade isto kao pre hardening-a; isti defekt (negativni radix literali) je nezavisno pronađen i izvršno dokazan.

## 3. Dual-scan — prvi pokušaj pao (prijavljeno)

Attempt 25 (`probe-repo.mjs` sa `DUAL_SCAN=1` na jsesc-u) je **prekinut posle 900 s** — interni spawn cap probe harness-a, ne API greška. Stvarni trošak $0 (prekinut pre `run.json`), rezervacija $4 ostaje kao `unknown-cost` (A4). Uzrok: Wonder scanner truncation + retry (32k tokena) → dual run traje ~29 min. Ponovni pokušaj (attempt 26) izmeren **direktno CLI-jem** kroz `final-run.sh` (bez probe omotača) i uspeo za 1722 s.

## 4. Ručna adjudikacija (HAND-CHECK po repou)

**24 published unosa ručno provereno, svaki sa statusom, težinom i načinom provere** (`<repo>/HAND-CHECK.md`):

| Ishod | Broj | Detalj |
|---|---:|---|
| Potvrđen stvarni defekt | 20 unosa (~15 jedinstvenih) | svaki potvrđen čitanjem koda; patch-proven gde postoji izvršni dokaz |
| Potvrđen — **adjudikacija ispravljena** | 1 | mustache F-001: prvobitna ocena je grešila; **TypeError je realan** (drugi lookup), tvrdnja iz runa je tačna |
| **Odbačen — nije defekt** | **1** | sax F-002 (valueless atribut ne može biti xmlns deklaracija; by design) |
| Latentan/dead-path (informational) | 2 | sax F-003 (nedostižna grana), jsesc F-003 (mrtav kod) |
| Uncertain, ručno potvrđen | 1 | jsesc F-002 (nepoznata `numbers` opcija → `undefined`) |

**Pošteno prijavljeno:** 1 lažno pozitivan nalaz (sax F-002) u 24; 0-nalaza run prijavljen (dateformat run1). Nijedan nalaz nije skriven niti ulepšan.

## 4b. Upstream provera i prijave (30.10.2026)

Svih 12 potvrđenih defekata provereno je u javnim trackerima i, gde ima smisla, prijavljeno.
**2 od 12 su bila poznata upstream pre naše analize** — nisu novi nalazi i tako su prikazani.

| # | Repo / defekt | Upstream status |
|---|---|---|
| 1 | mustache — cache `hasOwnProperty` shadowing | **već prijavljeno**: PR [#854](https://github.com/janl/mustache.js/pull/854) (open; povezan [#856](https://github.com/janl/mustache.js/issues/856)) — komentar sa nezavisnom potvrdom |
| 2 | mustache — kolizija keš ključa | neprijavljeno |
| 3 | sax — `SGML_DECL_QUOTED` bez `parser.q` | **prijavljeno 30.10.**: [#303](https://github.com/isaacs/sax-js/issues/303) |
| 4 | sax — `new Error(parser, …)` (latentan) | ne prijavljujemo (nedostižna grana, bez uticaja) |
| 5 | fast-json-patch — null deref `obj.toJSON` | **prijavljeno 30.10.**: [#337](https://github.com/Starcounter-Jack/JSON-Patch/issues/337) |
| 6 | fast-json-patch — `isInteger("")` | root pokriven PR-om [#331](https://github.com/Starcounter-Jack/JSON-Patch/pull/331) (leading zero) — komentar sa manifestacijom |
| 7 | fast-json-patch — observe prepisuje mirror baseline | neprijavljeno (low) |
| 8 | fast-json-patch — `~~key` truncation | neprijavljeno (low) |
| 9 | bcryptjs — `base64_decode` c4 | **već prijavljeno**: PR [#170](https://github.com/dcodeIO/bcrypt.js/pull/170) (open) — komentar sa nezavisnom (patch-proven) potvrdom |
| 10 | bcryptjs — hash ignoriše `genSalt` grešku | neprijavljeno |
| 11 | bcryptjs — `genSalt` baca sinhrono | neprijavljeno |
| 12 | dateformat — `yyyy` negativne godine | **prijavljeno 30.10.**: [#196](https://github.com/felixge/node-dateformat/issues/196) |

**Rezime:** **2 prethodno poznata upstream** (duplikati — pošteno navedeni, ne predstavljaju se kao novi) · **3 nova issue-a otvorena 30.10.** · **3 komentara** na postojeće prijave (mustache #854, bcrypt PR #170, fjp PR #331) · **5 nalaza ostaje neprijavljeno** (low uticaj / neaktivni repo / potreban dogovor o dizajnu). Nijedan nije prijavljen kao „novo otkriće“ — javni commitovi su stariji od analize.

## 4c. Ispravka hand-checka (mustache F-001)

Prvobitna adjudikacija je pogrešno tvrdila da do upisa u keš ne dolazi i da nema TypeError-a.
**Ispravljeno:** prvi lookup za `hasOwnProperty` pada u `else` granu (nasleđena metoda nije *own* property keša),
pa se vrednost upiše u keš; **drugi** lookup istog imena baca `TypeError: cache.hasOwnProperty is not a function`.
Originalna tvrdnja iz runa je **tačna**, a upstream PR #854 je nezavisno potvrđuje.

## 5. DoD 7 provera

| Zahtev | Rezultat |
|---|---|
| ≥1 execution-proven i ≥1 patch-proven na novim repoima | ✅ **bcryptjs**: 2× patch-proven (execution + patch, reprodukovano 3/3) |
| svi published ručno adjudikovani | ✅ 24/24, HAND-CHECK po repou |
| 0 lažnih posle hand-checka | ⚠️ **1 odbačen** (sax F-002) — prijavljeno, ne skriveno |
| 0-nalaza repoi prijavljeni kao takvi | ✅ dateformat run1 (0 nalaza) |
| regresioni par dokazuje L3/L4 kao pre hardeninga | ✅ picomatch + jsesc patch-proven |
| ≥1 refuted / odbijeni nalaz za video (S5) | ⚠️ u F4 nema **refuted** nalaza (svi verified/uncertain); za S5 se koristi evidentiran označen controlled test ili ručno odbačen nalaz (sax F-002) — odluka u F5 |
| upstream status svakog nalaza prijavljen | ✅ §4b: 2 već poznata (duplikati), 3 prijavljena 30.10., 3 komentara, 5 neprijavljenih — nijedan nije predstavljen kao novo otkriće |

## 6. Trošak i manifest

- F4: **$6,9050** (12 uspešnih runova + 1 prekinut, stvarno $0; 1 ponovni pokušaj).
- Runda ukupno: **$15,7163** od $40 (settled). `spentEffective` $25,7163 zbog $10 unknown-cost rezervacija (attempt 7 $4, 11 $2, 25 $4) — konzervativno, prijavljeno.
- Manifest `ATTEMPTS.jsonl`: attempt 13–26; `audit` PASS.

## 7. Artifakti

`real-world/<repo>/{probe.json,scope.json,<run>/}` + `HAND-CHECK.md` po repou; svi runovi verbatim (`run.json`, `findings.json`, `REPORT.md`, `REPORT.html`, `rejected.md`, `repro/`, `patch/`). `_repo` klonovi su git-ignored.
