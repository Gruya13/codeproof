# Test round — real-world probes (axios real/injected + fastify + cache/safety/parallel) — FINAL

**Datum:** 26–27.10.2026. **Budžet runde:** $20 (Meta API). **Ukupan trošak ove runde:** $1.8502 (kasniji real-repo runovi — execa, preact, luxon — su u `reports/real-world/` i ne ulaze u ovaj iznos).
**Harness:** scripts/probe-repo.mjs, scripts/make-injected.mjs, scripts/score-injected.mjs, scripts/probe-cache.mjs, scripts/probe-safety.mjs, scripts/probe-parallel.mjs.
**Pipeline je isključivo statički: nijedan analizirani kod nije izvršen kao deo analize.** Ručna adjudikacija fastify nalaza koristila je odvojen funkcionalni probe na kopiji repo-a u `/tmp` (vidi `real/fastify-lib/hand-check/`); to je izvan pipeline-a i označeno je u HAND-CHECK-u.

## 1. Metodologija

- Repo: **axios/axios**, fiksiran commit 790b5ba1d95a95e93d59b76995595c37f2b90a66 (v1.21.0), scope lib/.
- Klon: reports/probes/real/axios-lib/_repo (gitignored).
- **Ulaz u skener:** 72 fajla, 9.546 LOC, 177 import edge-eva, 0 ciklusa; prompt 338.330 chars (~94k tokena), **svih 72/72 fajlova ulazi** (proverено pre API poziva; cap 400.000 chars).
- Modeli: scanner muse-spark-1.3, verifier muse-wonder-1.0, MAX_FINDINGS=12, mode smoke.
- Artefakti po runu: run.json, findings.json, candidates.json, REPORT.md, rejected.md, probe.json.

## 2. Eksperiment A1 — čist realan repo (prirodni defekti, 2 runa)

| Run | Nalazi | Verified | Cena | Vreme | Keš |
|---|---|---|---|---|---|
| axios lib run 1 | 0 proposed | 0 | $0.1535 | 35 s | 0 / 93.127 |
| axios lib run 2 | **1 proposed** | 1 | $0.2240 | 67 s | 500 / 100.836 |

**Nalaz (run 2):** transformRequest u defaults/index.js vraća data.buffer za svaki ArrayBufferView, pa subarray/DataView sa byteOffset-om šalje ceo underlying buffer. **Ovo je potvrđen poznat upstream problem:** axios PR #1511 je popravljao „buffer pool“ i uklonio test „should transform TypedArrays without including buffer pool“; commit f2b478f (#2982, 2020-05-27) je revertovao tu popravku (− return data.slice().buffer; + return data.buffer;). Model je pronašao upravo revertovanu regresiju. Verifier: confirm; citat 70–72.

**Nalaz (oba runa):** na 9.5k LOC zrelog koda odziv je nestabilan (0 pa 1 nalaz); nijedan objavljeni nalaz nije bio lažan. Precision na objavljenom: 1/1 = 100% (nalaz odgovara poznatom upstream problemu). Recall na prirodnim defektima nije merljiv — nema ground truth-a.

## 3. Eksperiment A1b — injektovani realan repo (kontrolisani signal)

U klon je injektovano **6 poznatih correctness defekata** (4 modifikacije + 2 nova fajla), commit 776d018...; ground truth u expected.json. diff -rq pokazuje samo 6 tačaka razlike od čistog klona.

| Run | Published | Verified | L1 pass | Recall (defekti) | Precision | Cena | Keš |
|---|---|---|---|---|---|---|---|
| injected run 1 | 4 | 4 | 100% (4/4) | **3/6 (50%)** | 75% (3 TP + 1 extra) | $0.3448 | 1.000 |
| injected run 2 | 3 | 3 | 100% (3/3) | **3/6 (50%)** | 100% | $0.1656 | **94.669 / 116.463 (81%)** |

**Stabilnost:** oba runa nalaze ista 3 defekta (INJ-02 combineURLs, INJ-03 buildURL, INJ-05 scheduler); promašaji su **sistematski** (INJ-01 isAbsoluteURL non-string, INJ-04 InterceptorManager null slota, INJ-06 session missing await) — nijedan nije nađen ni u drugom runu.

**Tačnost citata:** svi verified nalazi imaju verbatim isečak i prolaze L1 (100%). Opseg je širi od minimalnog: line delta 11 (combineURLs), 4 (buildURL), 4 (scheduler) — model citira celu funkciju, ne tačnu liniju defekta. L1 to prihvata jer je isečak tačan; za „precizno pokazivanje linije“ to nije isto.

**Adjudikacija:** sva 3 injektovana nalaza su TP (claim + citat tačni); F-003 iz run 1 je extra-true (upstream revert regresija, vidi §2) — 75% je konzervativna cifra bez njega, 100% sa njim.

## 4. Eksperiment A2 — TTL prompt keša

Protokol: fiksni prefiks 338.330 chars (~94k tokena, axios lib digest), model muse-spark-1.3-contributor, dve nezavisne serije (različit system prompt ⇒ različiti cache prefiksi):
- serija A (kontinualna): warmup t=0, merenja na +2, +5, +10 min;
- serija B (izolovana): warmup t=0, jedino merenje na +10 min (bez osvežavanja).

| Merenje | cached_tokens | Cena |
|---|---|---|
| warmup A / B | 0 / 0 | $0.008986 svaki |
| A +2 min | 89.841 / 89.849 (99,99%) | $0.000181 |
| A +5 min | 89.841 / 89.849 (99,99%) | $0.000181 |
| A +10 min | 89.841 / 89.849 (99,99%) | $0.000181 |
| **B +10 min (izolovana)** | **89.841 / 89.849 (99,99%)** | $0.000181 |

**Nalaz:** TTL keša je **≥ 10 minuta** čak i kada se prefiks ne koristi između merenja; keš pokriva praktično ceo prefiks; cena keširanog poziva je **49,6× niža** ($0.008986 → $0.000181). Ukupan trošak eksperimenta: **$0.0187**. Rezultat je donja granica TTL-a (nije testirano >10 min), ne tačan TTL.

**Nezavisna potvrda iz realnih runova:** drugi run injektovanog repoa (37 s posle prvog) ima **94.669 od 116.463 input tokena iz keša (81%)** i košta $0.1656 umesto $0.3448 — keš radi bez ikakvog podešavanja, samo zato što je prefiks isti.

## 5. Eksperiment A3 — safety filteri

Fixture fixtures/safety-repo/ sa **inertnim** exploit-pattern stringovima (SSRF 169.254.169.254, SQLi ' OR '1'='1 / DROP TABLE, command $(rm -rf /), XSS <script>, path traversal) u kodu + jedan pravi correctness defekt; ništa se ne izvršava.

| Faza | finish_reason | JSON | Nalaz |
|---|---|---|---|
| scan (spark) | stop | validan | 2 nalaza (defekti u fixture-u, ne payload stringovi) |
| verify (wonder) | stop | validan | confirm za kontrolisanog SSRF kandidata; SSRF i command payload su bili u kontekstu |

**Dokaz:** nema transportne greške, nema content_filter, payload-i stižu do verifiera, obe faze normalno odgovaraju. **Safety filter nije blokirao analizu.** Trošak: $0.0748 (+ $0.0901 za prvi pokušaj).
> Napomena iz prvog pokušaja: verifier je jednom vratio finish_reason=length sa **praznim tekstom** (4000 tokena potrošeno, 0 chars) — to nije safety blokada nego truncation; pipeline to pokriva retry-em sa 2× budžetom. U drugom pokušaju isti poziv je prošao sa 4000 tokena.

## 6. Eksperiment A4 — paralelni pozivi

| Test | Rezultat |
|---|---|
| 6 paralelnih malih poziva | 6/6 ok, 0 retries → 429 nije izazvan (limit je visok za ovaj volumen) |
| warmup + 3 paralelna poziva sa istim prefiksom (94k tokena) | cached_tokens: **[81.905, 81.905, 0]** — 2/3 poziva vide keš (91% prefiksa), treći promašuje (backend routing) |

**Nalaz:** keš pomaže i pri paralelnim pozivima, ali nije garantovan za svaki paralelni poziv (2/3). Trošak: $0.0199.

## 7. Troškovi (Meta API, ova runda)

| Eksperiment | Trošak |
|---|---|
| axios čist run 1 | $0.1535 |
| axios čist run 2 | $0.2240 |
| axios injektovani run 1 | $0.3448 |
| axios injektovani run 2 | $0.1656 |
| safety (pokušaj 1, truncation) | $0.0901 |
| safety (pokušaj 2, uspešan) | $0.0748 |
| TTL keš | $0.0187 |
| paralelni pozivi | $0.0199 |
| fastify lib (drugi realan repo) | $0.7588 |
| **Ukupno** | **$1.8502** (od $20) |

## 8. Ograničenja

- n = 6 injektovanih defekata, 1 realan repo, 2 runa po eksperimentu — nije statistička tvrdnja.
- Injekcije i ground truth su napisani u ovoj sesiji; model ih nije mogao videti (nisu javni).
- Recall na prirodnim defektima nije merljiv; meren je recall na kontrolisanom signalu (3/6) i stabilnost kroz 2 runa.
- F-003/drugi čist run: jedan nalaz u jednom od dva runa; potvrđen kroz upstream istoriju, ali nije sistematski reproducibilan.
- Keš: jedan prefiks, jedan model za merenje; TTL je donja granica (≥10 min), ne tačna vrednost.
- Safety: jedan fixture i 2 poziva; pokazuje da nema blokade na ovom sadržaju, ne da je filter neosetljiv uopšte.

## 9. Eksperiment A1c — drugi realan repo: fastify 5.x @ lib/

- Repo: fastify/fastify, commit 5df959f3af698823dd582f1c3661f3e80df0b5da, scope lib/.
- Ulaz: **31 fajl, 8.351 LOC**, prompt 298.719 chars (~83k tokena), 31/31 fajlova ulazi.
- Run: **3 proposed / 3 verified**, L1 pass 100%, 6 poziva, 0 retry, **$0.7588**, 241 s, keš 1.500.

Ručna provera (F-001 **potvrđen kao pravi defekt**): content-type-parser.js — getParser kešira parser u this.cache (Fifo), a remove() briše iz customParsers i parserList **ali ne i iz keša**; posle uklanjanja getParser vraća uklonjeni parser iz keša. Model je citirao remove() (170–190) i tačno opisao mehanizam; verifier confirm. F-002 (four-oh-four double-bind) i F-003 (socket timeout) su ručno adjudikovani u §7: F-002 delimično potvrđen (low/informational), F-003 delimično potvrđen (low, retencija memorije).

**Nalaz:** na zrelom realnom repou model objavljuje 3 verified nalaza, a bar jedan je ručno potvrđen kao stvaran bug — ovo je najjači real-world dokaz do sada (nije injekcija, nije poznat upstream revert).

## 10. Clean-clone i replay (T-D2/T-D4, deterministički deo)

- **Clean clone (tmpfs + env -i):** scripts/clean-clone.sh — svež git clone --no-hardlinks u /tmp, env -i PATH=... (bez HOME, bez .env, bez lokalnih varijabli), pa make test → make demo → make score RUN=reports/golden → provera čistog stabla. **PASS na Node 22.23.3 i Node 26**, lokalni clone. **PASS i za javni repo** (github.com/Gruya13/codeproof) — objavljeni repo radi iz čistog klona.
- **Docker varijanta** (node:22-alpine) je izvršena 27.10. nakon sudo pristupa i prolazi: node v22.23.4, 89/89 testova, demo, score, git čist (PASS). Usput je popravljen lažni PASS u staroj skripti (vidi commit T-D3).
- **Replay L0/L1 (T-D4):** scripts/replay-gates.mjs + make replay — ponovo izvršava L0 i L1 nad sačuvanim findings.json iz reports/golden, na commit-u iz run.json, **bez ijednog model poziva**: **9/9 identično sačuvanom sudu, 0 mismatch, sha256 stabilan**. Artefakt: reports/probes/replay/26ab3dd52bcd1e4f-replay.json.

## 11. Fault injection (P0-C1, deterministički deo)

Dodato je +22 testa; kasnije F8 i V1 popravke dovele su do **89/89 na Node 22 i 26**: retry matrica (429→200, 500×N, 400 bez retry, mrežna greška, retry-after, 200+nevalidan JSON), callLog sada beleži finishReason i httpStatus, content_filter je jasna greška (CONTENT_FILTERED; scan abort, verify → uncertain + exit 1), dirty-JSON hardening (fence bilo gde, BOM, više objekata, komentari i single quotes karakterizacija), CLI truncation/abort test (prvi nevalidan pa validan scanner odgovor; oba nevalidna → abort sa last-scan-raw), config hash determinizam (MAX_FINDINGS/VERIFIER_CONTEXT_CHARS menjaju hash; BUDGET_USD ne menja). Autor: agy (predlog koda), primenjeno i verifikovano od orkestratora; jedan fajl (src/run/json.mjs) je rekonstruisan jer je markdown ekstrakcija pokvarila regex.

## 7. Ručna adjudikacija fastify F-002/F-003 (27.10.)

Detalji i probe: `real/fastify-lib/hand-check/HAND-CHECK.md`.

- **F-002 (404 defaultRoute double-bind)**: delimično potvrđeno; uticaj samo na emergency `defaultRoute` fallback („likely a fastify bug“ put), normalni prefiksovani 404 handleri su registrovani kao rute i nisu pogođeni. Ručna oznaka: low/informational (scanner: high).
- **F-003 (socket._meta cleanup gated)**: delimično potvrđeno — reprodukovano da bez loggera `socket._meta` i `timeout` listener ostaju posle završenog keep-alive odgovora (2 vs 1 listener sa loggerom). Uticaj je **retencija memorije** (poslednji request/reply/context po socketu do prepisivanja/zatvaranja), ne pogrešno ponašanje: `hookIterator` preskače hook kada je `reply.sent === true` (`lib/hooks.js:411`). Ručna oznaka: low (scanner: medium).
- Nijedan od dva nalaza nema odgovarajuću open upstream prijavu (pretrage: arrange404, defaultRoute bind, kFourOhFourLevelInstance, socket._meta).

## 12. Naknadne izmene (posle ove runde)

Ovaj izveštaj je pisan pre F8/V1 popravki i T-D3 Docker provere; aktuelno stanje je u README/STATUS:

- 89/89 testova (Node 22 i 26) posle F8 counter-citation politike i V1 popravki iz nezavisne verifikacije.
- Docker clean-clone (node:22-alpine) sada prolazi; skripta je popravljena da ne daje lažni PASS.
- F-002/F-003 fastify nalazi su adjudikovani (§7): oba delimično potvrđena, niža ozbiljnost od scannerove.
- Novi real-repo dokazi (execa, preact, luxon) su u reports/real-world/; ovaj probe direktorijum čuva sirove artefakte runde od 26.10.
