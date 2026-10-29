# F1 dogfood — HAND-CHECK (CodeProof na sopstvenom src/)

**Datum:** 2026-10-29. · **Kod:** `2e7cf6d` (chunked; HEAD u trenutku pokretanja) · **Autor adjudikacije:** DSH orkestrator
**Runovi (reports/final/self-analysis/):**

| Run | Dir | Modeli | Nalazi | Cena | Trajanje |
|---|---|---|---|---|---|
| chunked | `chunked/4cf698ba270f207e` | spark 1.3 / wonder 1.0 | 6 proposed → **5 verified, 1 uncertain**, 0 refuted, 1 reproduced, 1 patch-proven | **$2,2969** | 1195 s |
| single | `single/3ccffc296ca227aa` | spark 1.3 / wonder 1.0 | **0 proposed** | **$0,1495** | 74 s |

**Ukupno F1: $2,4464** (procena $4,5; cap bloka $6). Pošten ishod: single scan na celom `src/` nije našao ništa, chunked je našao 6 — isti obrazac kao u ranijim rundama (chunked recall > single).

## Adjudikacija svakog nalaza

| ID | Status sistema | Tvrdnja (kratko) | Adjudikacija | Težina (ručno) | Dokaz / način provere |
|---|---|---|---|---|---|
| F-001 | uncertain | Cross-verifikacija se aktivira samo za label `wonder`, ne i `secondary` (kad su modeli isti) | **nije defekt — namerno ponašanje** | — | `cli.mjs:471`: cross-verifier ima smisla samo kad postoji **drugi** model; `secondary` label nastaje upravo kad je sekundarni skener isti model (nema šta da se unakrsno proverava). Verifikator nije potvrdio (empty output, `finish_reason=length`). Nema fixa; pojašnjenje ide u kod/komentar (opciono). |
| F-002 | verified | `byScanner` brojanje ignoriše `secondary` label | **stvaran** | low | `cli.mjs:433-438`: broje se `spark/wonder/both/controlled`; `secondary` unos ulazi u `proposed`, ali ne u ijednu brojačku kantu → pogrešan `run.json.findings.byScanner` i log. Ne menja nalaze, samo accounting. **Fix + regresioni test.** |
| F-003 | verified (patch-proven) | `wordRegex` keš je `{}` → nasleđene osobine (`toString`, `constructor`, `__proto__`) vraćaju non-RegExp i `.test` puca | **stvaran** | medium | `repro/static-checks.mjs:7-12`: `__idRegexCache[name]` truthiness; nasleđena funkcija prolazi guard; poziva se na `:137`/`:140`. Reprodukovano 3/3 + patch-proven 3/3. **Fix + regresioni test.** |
| F-004 | verified | `hasTautology` traži self-comparison u celom fajlu, ne u assert segmentima → lažno odbija validne repro-e | **stvaran** | medium | `repro/static-checks.mjs:112-114`: `selfCompare.test(code)` pre `extractAssertSegments`. `x === x` van assert-a obara klasifikaciju. **Fix + regresioni test.** |
| F-005 | verified | `firstJsonObject`: backslash van stringa se tretira kao escape i preskače sledeći karakter → pogrešna granica objekta | **stvaran** | low | `run/json.mjs:55-59`: `escape` se postavlja bez obzira na `inString`. Robustnost dirty-JSON parsera; uticaj retry/parse. **Fix + regresioni test.** |
| F-006 | verified | LinkCheck proof sufiks se emituje za svaki status ≠ `unproven`, pa `error`/failed izveštaj tvrdi „the imported symbol executed“ | **stvaran** | medium | `synthesize/index.mjs:189-192`; `error` status realno nastaje u `repro/linkcheck.mjs:93,101`. Lažna tvrdnja o izvršnom dokazu u javnom REPORT-u — ozbiljno za poštenje. **Fix + regresioni test.** |

**Zaključak adjudikacije:** **5 stvarnih defekata** (F-002…F-006), **0 lažnih nalaza**, **1 nije defekt** (F-001) i **0 neadjudikovanih**. Svi stvarni idu u fix + regresioni test (test piše asistent, autor u commit poruci, test-lock), pa re-run dogfooda na popravljenom kodu (PREREG §4.2).

## 2. Fixevi i re-run (posle adjudikacije)

**Fixevi (autor DSH, commit `1b07caf`):** F-002 `countByScanner` (+ `secondary` kanta; `cli.mjs` ga koristi);
F-003 prototype-less keš (`Object.create(null)`); F-004 self-comparison samo u assert segmentima;
F-005 backslash je escape samo unutar stringa; F-006 proof sufiks samo za `proven` LinkCheck.

**Regresioni testovi (autor codex):** `tests/dogfood-fixes.test.mjs` (5 testova, svaki padao pre fixa),
commit testova `0cc0849`, test-lock `2f1c568`. Suita: **268/268** na Node 26 i Node 22, integrity PASS.

**Re-run na popravljenom kodu (revizija `2f1c568`, kroz `final-run.sh`):**

| Run | Dir | Rezultat | Cena | Trajanje |
|---|---|---|---|---|
| chunked-r2 | `chunked-r2/8adb643a9ac70162` | **0 proposed** | **$0,3793** | 363 s |
| single-r2 | `single-r2/8f1a9861e591b2d7` | **0 proposed** | **$0,1214** | 42 s |

**F1 ukupno:** 4 pokušaja = **$2,9470** (procena $4,5; cap bloka $6). Manifest: `reports/final/ATTEMPTS.jsonl` (attempt 1–4).

**Tumačenje re-runa:** nijedan od pet popravljenih defekata se ne pojavljuje na popravljenom kodu, ali
re-run je vratio 0 kandidata i u chunked i u single modu — model varijansa je velika (chunked r1: 6 proposed
za $2,30; chunked r2: 0 za $0,38). Zato se ovo prijavljuje kao **pošten ishod**, a ne kao dokaz da u kodu
nema drugih defekata: dokaz da su popravke ispravne su **fiksni kod + 5 regresionih testova**, a ne re-run.

## Šta nije urađeno

- F-001 nije popravljan jer nije defekt; ako se ipak želi eksplicitno ponašanje, to je docs/komentar, ne kod.
- Re-run dogfooda je urađen i prijavljen gore (0 nalaza, pošteno).
