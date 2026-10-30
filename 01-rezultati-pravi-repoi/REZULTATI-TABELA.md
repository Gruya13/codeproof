# Rezultati na pravim repozitorijumima — finalna runda (F4)

> Izvod iz finalnog paketa dokumenata (30.10.2026). Sirovi artefakti svih 13 runova su u [reports/final/real-world/](../reports/final/real-world/), a plan runde u [reports/final/](../reports/final/).

**Izvor podataka:** `../reports/final/real-world/<repo>/<runId>/run.json` — svaka brojka u tabeli je prepisana iz tog fajla
(skripta je pročitala svih 13 `run.json`, ništa nije ručno kucano).

**Runda:** tag `v0.2.3-final` (revizija `490e302`, `src` tree `f874d642`), 29–30.10.2026.
Svi runovi su pravi API pozivi (`mock: false`), kroz `scripts/final-run.sh` (rezervacija → git sidrenje → run → settle).

## 1. Zbirno

| Metrika | Vrednost |
|---|---:|
| Runova (10 na 5 novih repoa + 3 regresiona) | 13 |
| Kandidata predloženih (scanner) | 29 |
| Odbijeno na L0 (format) | 0 |
| Odbijeno na L1 (citat) | 7 |
| **Prošlo obe kapije (`verified`, L1+L2)** | **21** |
| Odbijeno od verifikatora (`refuted`, L2) | 0 |
| Neodlučeno (`uncertain`) | 1 |
| Izvršno dokazano (`reproduced`, L3) | 6 |
| Patch dokazano (`patched`, L4) | 6 |
| Trošak ovih 13 runova | **$6.9050** |

> `verified` znači L1 citat + L2 adversarialno potvrđivanje. `reproduced`/`patched` su dodatni nivoi dokaza (L3/L4)
> i ne menjaju status `verified`. Ručna adjudikacija je zaseban korak — u folderu `02-rucna-validacija`.

## 2. Po repou i runu

| Grupa | Repo | Pin (commit) | Scope | Fajlovi / LOC | Run | Fajlova u promptu | Proposed | L0 | L1 | **Verified** | Refuted | Uncertain | Repro | Patch | Cena | Trajanje |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| novi repo | mustache | 972fd2b27a036888acfcb60d6119317744fac7ee | . (ceo repo) | 80 f. / 2402 LOC | 4d11c6d684b65418 | 80 / 80 | 2 | 0 | 0 | **2** | 0 | 0 | 0 | 0 | $0.4756 | 199 s |
| novi repo | mustache | 972fd2b27a036888acfcb60d6119317744fac7ee | . (ceo repo) | 80 f. / 2402 LOC | 4d11c6d684b65418-2 | 80 / 80 | 1 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | $0.4067 | 187 s |
| novi repo | sax | 961ceeefcc5186005466f2085aeb36f31b161e37 | lib | 1 f. / 1866 LOC | 86ed5667b2ec15cc | 1 / 1 | 4 | 0 | 3 | **1** | 0 | 0 | 0 | 0 | $0.3164 | 146 s |
| novi repo | sax | 961ceeefcc5186005466f2085aeb36f31b161e37 | lib | 1 f. / 1866 LOC | 86ed5667b2ec15cc-2 | 1 / 1 | 3 | 0 | 0 | **3** | 0 | 0 | 0 | 0 | $0.8008 | 361 s |
| novi repo | fast-json-patch | 9d313ac01916e525e9204074f06e5295edec491b | commonjs | 3 f. / 803 LOC | 4e12c16371305216 | 3 / 3 | 4 | 0 | 3 | **1** | 0 | 0 | 0 | 0 | $0.2514 | 137 s |
| novi repo | fast-json-patch | 9d313ac01916e525e9204074f06e5295edec491b | commonjs | 3 f. / 803 LOC | 4e12c16371305216-2 | 3 / 3 | 4 | 0 | 1 | **3** | 0 | 0 | 0 | 0 | $0.4997 | 259 s |
| novi repo | bcryptjs | 1211e9a2213e0b3ee232a204b3ce899beebce31a | . (ceo repo) | 11 f. / 1666 LOC | 56f8831fa1284062 | 11 / 11 | 3 | 0 | 0 | **3** | 0 | 0 | 1 | 1 | $0.9219 | 326 s |
| novi repo | bcryptjs | 1211e9a2213e0b3ee232a204b3ce899beebce31a | . (ceo repo) | 11 f. / 1666 LOC | 56f8831fa1284062-2 | 11 / 11 | 1 | 0 | 0 | **1** | 0 | 0 | 1 | 1 | $0.3876 | 139 s |
| novi repo | dateformat | e6800aa902fcbd523d5ea06a9a79050878cfa48e | . (ceo repo) | 43 f. / 2085 LOC | fead8f9fa0544305 | 43 / 43 | 0 | 0 | 0 | **0** | 0 | 0 | 0 | 0 | $0.0717 | 41 s |
| novi repo | dateformat | e6800aa902fcbd523d5ea06a9a79050878cfa48e | . (ceo repo) | 43 f. / 2085 LOC | fead8f9fa0544305-2 | 43 / 43 | 1 | 0 | 0 | **1** | 0 | 0 | 0 | 0 | $0.1945 | 99 s |
| regresija | picomatch-regression | 6bb40679c218cefba5d4e9662408c5fdf699a8bb | lib | 5 f. / 2445 LOC | 14ba4cc9f28e0092 | 5 / 5 | 1 | 0 | 0 | **1** | 0 | 0 | 1 | 1 | $0.5465 | 286 s |
| regresija | jsesc-regression | e3349b542eaaf55239cb60519991b80097cee24b | analysis-target | 1 f. / 337 LOC | ea5b1ae7f3eeac48 | 1 / 1 | 3 | 0 | 0 | **2** | 0 | 1 | 1 | 1 | $0.6289 | 308 s |
| regresija | jsesc-dual-r2 | e3349b542eaaf55239cb60519991b80097cee24b | analysis-target | 1 f. / 337 LOC | 1e1b03c5d8ba9776 | 1 / 1 | 2 | 0 | 0 | **2** | 0 | 0 | 2 | 2 | $1.4033 | 1722 s |

## 3. Konfiguracija po runu (dokaz da je prompt isti u svih 13)

| Run | Mode | Node | CodeProof | Scanner prompt | Verifier prompt |
|---|---|---|---|---|---|
| 4d11c6d684b65418 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 4d11c6d684b65418-2 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 86ed5667b2ec15cc | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 86ed5667b2ec15cc-2 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 4e12c16371305216 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 4e12c16371305216-2 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 56f8831fa1284062 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 56f8831fa1284062-2 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| fead8f9fa0544305 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| fead8f9fa0544305-2 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 14ba4cc9f28e0092 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| ea5b1ae7f3eeac48 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |
| 1e1b03c5d8ba9776 | smoke | v26.8.2 | 0.2.2 | v3 / e0b10604b50f | v1 / e2e6c4a4ddbe |

Sva 13 runa imaju **istu** scanner prompt verziju i isti SHA256 (`e0b10604b50f…` = v3) i istu verifier verziju
(`e2e6c4a4ddbe…` = v1). To je zato što je kod zamrznut pre runde (`FREEZE.json`) i nijedan prompt
nije menjan tokom merenja.

## 4. Šta je u kojem fajlu

| Fajl | Sadržaj |
|---|---|
| `run.json` | cela konfiguracija, modeli, **prompt SHA256**, commit, LOC, brojanje nalaza, potrošnja, faze, `repro`/`patch` statusi, atestacija artefakata |
| `findings.json` | svaki objavljeni nalaz: id, tvrdnja, citat (path/startLine/endLine/snippet), status, nivo dokaza, verifier verdict, counter-evidence |
| `REPORT.md` / `REPORT.html` | ljudski izveštaj istog runa (HTML je statična kopija, bez JS i mreže) |
| `rejected.md` | kandidati koji **nisu** prošli obe kapije, po fazama (L0/L1/moderate/refuted/uncertain) — vidi `03-rejected` |
| `candidates.json` | svi kandidati pre kapija (sirov scanner izlaz) |
| `repro/`, `patch/` | generisani test (L3) i predloženi patch (L4) gde su postojali |
| `probe.json`, `scope.json` | ulaz probe harness-a: scope, broj fajlova/LOC, komanda runa |

## 5. Upstream status (30.10.2026)

Detalj i linkovi: `../02-rucna-validacija/UPSTREAM-STATUS.md`. Kratko: **nijedna prijava nije prihvaćena ni
merge-ovana**; 2 od 12 defekata su bila poznata upstream pre analize (mustache PR #854, bcryptjs PR #170),
3 su novi issue-i otvoreni 30.10. (fast-json-patch #337, dateformat #196, sax #303), 3 su komentari na
postojeće prijave, 5 ostaje neprijavljeno.

## 6. Poštenja radi (ograničenja, kako ih navode i sami dokumenti)

- **n = 13 runova na 8 pinova**: anegdota, ne statistička mera; javni commitovi → kontaminacija je moguća.
- **2 od 12** defekata u novim repoima su **duplikati** — već prijavljeni pre naše analize i tako označeni, ne kao nova otkrića.
- **0 odgovora maintainera** na dan 30.10.2026: status je „podneto“, ne „prihvaćeno“.
- **dateformat run1** je vratio 0 nalaza — i to je objavljeno, nije sakriveno.
- **sax F-002** je prošao obe kapije, a ručna provera ga je odbacila kao `by design` — 1 lažni pozitiv u skupu,
  prijavljen u `02-rucna-validacija`.
