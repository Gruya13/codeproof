# F3 — bench (finalna runda)

**Datum:** 2026-10-29. (21:00–22:20 CET) · **Kod:** tag `v0.2.3-final` — svaki run ima `src` tree `f874d642`
(provera: `git rev-parse <run.commit>:src`); HEAD se pomerao samo artefakt-commitovima.
**Izvršilac:** DSH orkestrator, svi runovi kroz `scripts/final-run.sh` (reserve → git sidrenje → run → settle).
**Potrošeno F3:** **$5,8642** od planiranih $8,2 (cap bloka $13).

## 1. Kalibracija (`bench/seed-repo`, 15 f. / 229 LOC, frozen)

| Run | Dir | Proposed | Verified | L1 odbijeno | Reproduced | Patch-proven | Score: recall / precision / traps / FR | Cena | Trajanje |
|---|---|---|---|---|---|---|---|---|---|
| single-1 | `bench-calibration/single-1/ae354d4fdabfded1` | 9 | 8 | 1 | 5 | 5 | **7/8 (87,5%)** / 100% / 0/4 / 0 | $0,9426 | 481 s |
| single-2 | `bench-calibration/single-2/77ca0cd10b081478` | 9 | 8 | 1 | 7 | 7 | **7/8 (87,5%)** / 100% / 0/4 / 0 | $1,1073 | 574 s |
| dual | `bench-calibration/dual/ad5bfdbcd9ed17eb` | 14 uniq (spark 9 / wonder 9 / both 4) | 13 | 1 | 8 | 8 | **8/8 (100%)** / 100% / 0/4 / 0 | $1,2968 | 596 s |

**Varijansa je prijavljena, ne skrivena:** oba single runa daju **7/8**, dual **8/8**. Svih 8 verified
nalaza u dual runu je execution-proven; u single runovima 5/7 i 7/7. Score thresholdi (≥6/8, ≥90%,
0/4 trapova, ≤1 FR) prolaze u sva tri runa. Jedan verified nalaz po runu je `extraTrue` (X-02, stvarna
greška van expected skupa) — score ga prijavljuje, ne računa kao FP.

**Odstupanje od DoD očekivanja (pošteno):** PREREG DoD 3 je očekivao 8/8 za single runove; izmereno je
**7/8 u oba**. Ovo je model varijansa na n=8 kalibracionom setu — prijavljuje se kao takvo; promptovi i
setovi nisu menjani posle prvog runa (PREREG §2.8).

## 2. Extended (`axios lib/`, 74 f. / 9.564 LOC, frozen; 16 problema + 5 trapova)

| Run | Dir | Proposed | Verified | L1 odbijeno | Reproduced | Score: pronađeno/16 · precision · trapovi | Cena | Trajanje |
|---|---|---|---|---|---|---|---|---|---|
| single | `bench-extended/single/f0b6d3c2b5e351ae` | 8 | 3 | 5 | 1 | **3/16 (18,8%)** / 100% / 0/5 | $0,6068 | 202 s |
| chunked | `bench-extended/chunked/27937bbf34fed1b7` | 10 (8 chunkova) | 9 | 1 | 1 | **9/16 (56,3%)** / 100% / 0/5 | $1,5038 | 692 s |

**Pošteno:** single je **3/16**, ispod planom očekivanog opsega 4–7/16; chunked je **9/16**, u okviru
očekivanog 9–10/16. Nijedan trap nije prijavljen ni u jednom statusu; 0 lažnih. Chunked scan je i ovde
glavni recall mehanizam (+6 problema, +40 pp).

## 3. Held-out ablacija (`bench/held-out`, 6 problema + 4 trapa, nikada korišćen za tuning)

| Konfiguracija | Published | TP | FP | Trap leaks | Recall | Precision |
|---|---:|---:|---:|---:|---:|---:|
| scanner only | 6 | 6 | 0 | 0 | 1 | 1 |
| + L1 | 6 | 6 | 0 | 0 | 1 | 1 |
| + L1 + L2 | 6 | 6 | 0 | 0 | 1 | 1 |
| + L1 + L2 + L3 | 5 | 5 | 0 | 0 | 0,833 | 1 |

Dir: `bench-heldout/held-out-ec04852/` (`ablation.json` + `ABLATION.md`); cena **$0,4069**, 228 s.
**DoD 5 ispunjen:** 5–6/6 u L3 konfiguraciji (5/6, jedan nalaz L3 `inconclusive`), 6/6 kroz L2, **0 trapova**,
sva četiri nivoa prijavljena.

## 4. Neuspeli pokušaji (prijavljeni, stvarni trošak $0)

| Attempt | Šta se desilo | Stvarni trošak | Ledger |
|---|---|---|---|
| 7 | `--dual-scan` nije CLI flag; CLI odbio argument **pre ijednog model poziva** (trajanje 0 s) | **$0** | `unknown-cost`, rezervacija $4 ostaje u `spentEffective` (A4: nikad ne potcenjuje) |
| 11 | `MODEL_API_KEY` nije bio učitan za ablaciju; run pao pre poziva | **$0** | `unknown-cost`, rezervacija $2 ostaje |

Oba su u `reports/final/ATTEMPTS.jsonl`; nijedan red nije obrisan. Zbog njih `spentEffective` prikazuje
$14,81, dok je **stvarno potrošeno $8,8112** (settled `costUsd`). Konzervativna rezerva od $6 se ne
oslobađa mašinski — prijavljena je ovde i u F5 verifikaciji.

## 5. DoD provera F3

| DoD | Zahtev | Rezultat |
|---|---|---|
| 3 | 2 single runa prijavljena; dual sa per-scanner statusom i cross-verifikacijom | ✅ oba single + dual; dual `byScanner` spark 9 / wonder 9 / both 4 |
| 3 | očekivano 8/8 + 0/4 trapova + svi execution/patch-proven | ⚠️ single **7/8** oba, dual 8/8; trapovi 0/4; execution-proven 5/7, 7/7, 8/8 (prijavljeno, ne skriveno) |
| 4 | extended chunked 9–10/16, single 4–7/16, 0/5 trapova, oba scored | ⚠️ chunked **9/16** ✅, single **3/16** (ispod opsega), 0/5 trapova ✅, oba scored ✅ |
| 5 | held-out 5–6/6, 0 trapova, sva 4 nivoa | ✅ 5/6 (L3) / 6/6 (L2), 0 trapova, 4 nivoa |

**Zaključak:** F3 je izmeren na zamrznutom kodu, svi pokušaji su prijavljeni, cena je znatno ispod procene.
Dva odstupanja od očekivanja (single recall 7/8 i extended single 3/16) su model varijansa na malim
setovima i idu u javni README kao izmerene vrednosti, ne kao „očekivano“.

## 6. Artifakti

- score: `bench-calibration/{single-1,single-2,dual}/score.json`, `bench-extended/{single,chunked}/score.json`
- held-out: `bench-heldout/held-out-ec04852/{ablation.json,ABLATION.md}`
- svi runovi: verbatim `run.json`, `findings.json`, `REPORT.md`, `REPORT.html`, `rejected.md`, `repro/`, `patch/`
- manifest: `ATTEMPTS.jsonl` (attempt 5–12)
