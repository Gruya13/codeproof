# Final evaluation — reports/final (2026-10-29/30)

Završna runda merenja na **zamrznutom kodu**: tag [`v0.2.3-final`](FREEZE.json) (revizija `490e302`,
`src` tree `f874d642`). Svaki run je ušao kroz `scripts/final-run.sh` (rezervacija → git sidrenje → run →
settle); svi pokušaji su u [`ATTEMPTS.jsonl`](ATTEMPTS.jsonl) i nijedan nije obrisan.
**Ukupan trošak runde: $15,7163 od $40** (cilj $35 — nije dostignut; hard cap nije prekoračen).
Plan i recenzije: [PREREG](PREREG.md) + [A1](PREREG-AMENDMENT-1.md)–[A4](PREREG-AMENDMENT-4.md) + [REVIEW](PREREG-REVIEW.md).

> **Napomena o ponovnom objavljivanju:** sve što je iz ove runde **već ranije objavljeno** (v0.2.2 sample u
> javnom README-u, upstream issue-i/PR-ovi) ovde je označeno kao **re-confirmed** i ne predstavlja se kao
> nov nalaz. Tabela §4 razdvaja novo od ponovljenog.

## 1. F0 — deterministički baseline

| Provera | Rezultat |
|---|---|
| Testovi | **268/268** na Node 26.8.2 i Node 22.23.3 |
| Integrity | PASS 22 checks (baseline `2040aa9`) |
| Replay | 9/9 identical, 0 mismatch |
| Score golden | PASS |
| Clean clone (tmpfs + `env -i`) | PASS |
| Clean clone Docker `node:22-alpine` | PASS |
| Budget wrapper | `final-budget.mjs` (reserve/check/settle/audit) + `final-run.sh`; A4 validacija troška; hard cap $40 nepotkopiv; git-anchored rezervacija pre svakog runa |

Detalj: [F0-baseline.md](F0-baseline.md).

## 2. F1 — dogfood (CodeProof na sopstvenom `src/`)

| Run | Nalazi | Cena | Trajanje |
|---|---|---|---|
| chunked r1 | 6 proposed → 5 verified, 1 reproduced, 1 patch-proven | $2,2969 | 1195 s |
| single r1 | 0 proposed | $0,1495 | 74 s |
| chunked r2 (posle fixeva) | 0 proposed | $0,3793 | 363 s |
| single r2 (posle fixeva) | 0 proposed | $0,1214 | 42 s |

**5 stvarnih defekata popravljeno** (F-002…F-006) + **5 regresionih testova** (autor codex, test-lock);
1 prijava nije defekt (F-001), 0 lažnih. Detalj: [self-analysis/HAND-CHECK.md](self-analysis/HAND-CHECK.md).
**F1 ukupno: $2,9470.**

## 3. F3 — bench (na zamrznutom kodu)

### Kalibracija (`bench/seed-repo`, 229 LOC, n=8)

| Run | Verified | Score: recall / precision / traps / FR | Cena |
|---|---|---|---|
| single-1 | 8 | **7/8 (87,5%)** / 100% / 0/4 / 0 | $0,9426 |
| single-2 | 8 | **7/8 (87,5%)** / 100% / 0/4 / 0 | $1,1073 |
| dual | 13 | **8/8 (100%)** / 100% / 0/4 / 0 | $1,2968 |

Oba single runa i dual su prijavljeni; varijansa nije skrivena. Detalj: [F3-bench.md](F3-bench.md).

### Extended (`axios lib/`, 9.564 LOC, 16 problema + 5 trapova)

| Run | Defects verified | Precision / traps | Cena |
|---|---|---|---|
| single | **3/16 (18,8%)** | 100% / 0/5 | $0,6068 |
| chunked | **9/16 (56,3%)** | 100% / 0/5 | $1,5038 |

### Held-out (`bench/held-out`, 6+4)

| Konfiguracija | Published | TP | FP | Trap | Recall |
|---|---:|---:|---:|---:|---:|
| scanner only / +L1 / +L2 | 6 | 6 | 0 | 0 | 1 |
| +L1+L2+L3 | 5 | 5 | 0 | 0 | 0,833 |

**F3 ukupno: $5,8642.**

## 4. F4 — real world (5 novih repoa + regresija)

### 4a. NOVO u ovoj rundi (nije objavljeno u ranijim rundama; upstream status u §4d)

| Repo | Pin | Nalazi (ručno potvrđeno) | Dokaz | Cena |
|---|---|---|---|---|
| mustache | `972fd2b2` | 2 defekta (F-001 je tačan i već prijavljen upstream — PR #854) | citation+adversarial | $0,8823 |
| sax | `961ceeef` | 2 defekta (1 latentan) + 1 odbačen ručno | citation+adversarial | $1,1172 |
| fast-json-patch | `9d313ac0` | 4 defekta | citation+adversarial | $0,7511 |
| bcryptjs | `1211e9a2` | 3 defekta, **1 jedinstven defekt patch-proven u oba runa** | execution + patch | $1,3095 |
| dateformat | `e6800aa9` | 1 defekt (+ jedan 0-nalaza run) | citation+adversarial | $0,2662 |

**Novi nalazi u F4: 12 jedinstvenih defekata** (mustache 2, sax 2, fast-json-patch 4, bcryptjs 3, dateformat 1).
**Upstream status:** 2 su **već bila prijavljena** pre naše analize (mustache PR #854, bcryptjs PR #170 — nisu novi),
**3 su prijavljena 30.10.** (fast-json-patch #337, dateformat #196, sax #303), 3 komentara su ostavljena na postojeće
prijave, a 5 ostaje neprijavljeno — detalj u §4d. Hand-check: [mustache](real-world/mustache/HAND-CHECK.md) ·
[sax](real-world/sax/HAND-CHECK.md) · [fast-json-patch](real-world/fast-json-patch/HAND-CHECK.md) ·
[bcryptjs](real-world/bcryptjs/HAND-CHECK.md) · [dateformat](real-world/dateformat/HAND-CHECK.md).

### 4b. RE-CONFIRMED — već objavljeno ranije, sada nezavisno ponovo potvrđeno

| Nalaz | Pin | Gde je već objavljen | Ovaj run | Dokaz |
|---|---|---|---|---|
| picomatch: trailing token se ne postavi kad je poslednji slash na indeksu 0 (`prevIndex` truthiness) | `6bb40679` (= 4.0.7, isti pin kao v0.2.2) | javni README §v0.2.2 sample („leading slash skips the last token update“) — već objavljen | `14ba4cc9` | **patch-proven** |
| jsesc: negativni brojevi u hex/bin/oct daju nevalidan literal (`0x-FF`) | `e3349b54` (= v3.1.0, isti pin kao v0.2.2) | javni README §v0.2.2 sample + **upstream [jsesc #79](https://github.com/mathiasbynens/jsesc/issues/79)** (PR #80 open, delimičan fix) | `ea5b1ae7`, `1e1b03c5` (dual) | **patch-proven** |
| jsesc: nepoznata `numbers` opcija → `undefined` | isti | nije ranije objavljen; u ovoj rundi `uncertain`, ručno potvrđen u hand-check-u | `ea5b1ae7` | statički |
| jsesc: mrtav `else if (isBigInt)` branch | isti | nije ranije objavljen | `ea5b1ae7` | statički (informational) |

**Re-confirmed uloga:** regresioni par dokazuje da **L3/L4 rade isto kao pre hardening-a** (PREREG DoD 7);
isti defekti su ponovo pronađeni i izvršno dokazani. Ovi nalazi se **ne objavljuju kao novi**.

### 4c. Regresija — trošak

| Meta | Cena |
|---|---|
| picomatch (1 run) | $0,5465 |
| jsesc (1 run) | $0,6289 |
| jsesc dual (1 run, posle 1 prekinutog pokušaja) | $1,4033 |

**F4 ukupno: $6,9050.**

## 4d. Upstream provera i prijave (30.10.2026)

| Upstream status | Nalazi |
|---|---|
| **Već prijavljeno pre analize** (duplikati; pošteno navedeni) | mustache F-001 → PR [#854](https://github.com/janl/mustache.js/pull/854) (+[#856](https://github.com/janl/mustache.js/issues/856)); bcryptjs F-003 → PR [#170](https://github.com/dcodeIO/bcrypt.js/pull/170) |
| **Novi issue-i otvoreni 30.10.** | fast-json-patch F-001 → [#337](https://github.com/Starcounter-Jack/JSON-Patch/issues/337); dateformat F-001 → [#196](https://github.com/felixge/node-dateformat/issues/196); sax F-001 → [#303](https://github.com/isaacs/sax-js/issues/303) |
| **Komentari na postojeće** | mustache #854 (nezavisna potvrda), bcrypt PR #170 (patch-proven potvrda), fast-json-patch PR [#331](https://github.com/Starcounter-Jack/JSON-Patch/pull/331) (`isInteger("")` manifestacija, isti root) |
| **Neprijavljeno** | mustache F-002, fast-json-patch F-002/F-004, bcryptjs F-001/F-002, sax F-003 (latentan) |

Nijedan nalaz nije prijavljen kao „novo otkriće“ — javni commitovi su stariji od analize; u prijavama je naveden tačan pin.

## 5. DoD status (PREREG §6)

| # | Zahtev | Rezultat |
|---|---|---|
| 1 | svaki headline broj ima svež artefakt | ✅ sve tabele gore imaju run dir |
| 2 | deterministički set svež | ✅ 268/268 × 2 Node, integrity/replay/score/demo/clean-clone/Docker |
| 3 | kalibracija: 2 single prijavljena; očekivano 8/8 | ⚠️ single **7/8** oba; dual 8/8 — prijavljeno |
| 4 | extended chunked 9–10/16, single 4–7/16, 0/5 trapova | ⚠️ chunked **9/16** ✅; single **3/16** (ispod opsega) |
| 5 | held-out 5–6/6, 0 trapova, 4 nivoa | ✅ 5/6 (L3), 6/6 (L2), 0 |
| 6 | dogfood: 0 neadjudikovanih, svi stvarni popravljeni + test | ✅ |
| 7 | real world: ≥1 execution/patch-proven na novim repoima; hand-check; 0 lažnih | ✅ execution/patch: bcryptjs; hand-check 24/24; ⚠️ 1 odbačen ručno (sax F-002) |
| 8 | agy-verify + codex WATCHDOG | vidi [F5-baseline](F5-baseline.md) i verifikacione zapise |
| 9 | frozen artefakti netaknuti | ✅ integrity PASS |
| 10 | README/STATUS bez stale brojeva | vidi javni README sekciju “Final evaluation” |

## 6. Ograničenja

- Kalibracioni set je n=8 i korišćen je za kalibraciju — nije statistička tvrdnja.
- Real-world nalazi su anegdote (mali n, javni commitovi → kontaminacija moguća). Upstream status: 2 od 12 su već bila prijavljena (duplikati), 3 prijavljena 30.10. — **nijedna prijava još nema odgovor maintainera**, pa nema spoljne potvrde.
- Model izlaz nije bit-determinističan; broj pokušaja se uvek navodi.
- `execution-proven`/`patch-proven` postoje samo na Node 26.8.2 (LinkCheck zahteva `--allow-inspector`).
- `spentEffective` je **$25,7163** jer $10 čine `unknown-cost` rezervacije iz tri prekinuta/odbijena pokušaja (attempt 7, 11, 25; stvarni trošak $0 — CLI je odbio pre ijednog model poziva); settled trošak runde je **$15,7163**.
- Logika zapisa: `reports/golden/` i ostali frozen artefakti su istorijski (26–28.10.) i netaknuti; finalna runda koristi `reports/final/`.
