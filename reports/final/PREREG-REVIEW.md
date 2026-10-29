# Nezavisna recenzija plana — zapis procesa (6 rundi)

**Rezultat: DOGOVOR POSTIGNUT.** Oba recenzenta su u rundi 6 dala **AGREE** na zaključan plan (`PREREG.md` v1.0 + `AMENDMENT-1..4`, `PREREG.lock.json` v1.5).

| | agy-verify | codex-verify |
|---|---|---|
| Runda 1 | AGREE WITH CONDITIONS (AG-1..7, 5 uslova) | DISAGREE (CX-1..7) |
| Runda 2 | prihvatio zajedničku listu od 9 uslova | prešao na AGREE WITH CONDITIONS (9 uslova) |
| Runda 3 | AGREE na A1 | DISAGREE (3 nalaza: score, jsesc, rezervacija) |
| Runda 4 | AGREE WITH CONDITIONS (3 stvari) | DISAGREE (isti 3 + 2 dopune) |
| Runda 5 | AGREE na A3 | DISAGREE (1 P0: validacija `costUsd`) |
| Runda 6 | **AGREE** na A4 | **AGREE** na A4 |

**Ukupno:** 6 rundi, 13 poziva (agy 7 — jedan prekinut timeout-om u rundi 1 i ponovljen; codex 6). Slepi ulaz: recenzenti nisu dobijali reasoning orkestratora, samo plan, artefakte i nalaze drugog recenzenta u rundama razmene. Nijedan API poziv ka Muse modelima nije napravljen.

## Šta je dogovoreno (ugrađeno kroz A1–A4)

1. **9 zajedničkih uslova** (A1): gitignore za klonove, tačne score komande, `ablation.json` dokazni izuzetak, ponovljivi pinovi za regresioni par, zamrznut extended `_repo`, pre-lock real-world kandidata, zbirni budžetski ledger, manifest svih pokušaja, puna deterministička provera posle freeze-a.
2. **Izvršne komande i pinovi** (A2): konkretne score komande bez „latest"; jsesc rekonstrukcija sa commit korakom i sha256; budžetska rezervacija pre poziva; manifest polja.
3. **Hermetički budžet** (A3): `hardBudget` fix u ablaciji + test; settle iz `ablation.json`; git commit rezervacije **pre** svakog API poziva; blokada visećih rezervacija; audit artefakata.
4. **Validacija troška** (A4): `settle` prihvata samo `measured:true` + konačan nenegativan broj; sve ostalo `unknown-cost` uz trajnu rezervaciju + 9 obaveznih test slučajeva.

## Ispravke koje je recenzija našla

- **Baseline troška:** stari $42,4571 bio je pogrešan (dedup po `runId` spajao je različite pokušaje) → **$55,8970** ukupno / **$50,3643** git-tracked.
- **Zbir capova** je bio $43 > $40 → sada tačno **$40** (target $35).
- **`make bench` score komanda** iz originalnog plana bi pala sa ENOENT (run nastaje u `<out>/<runId>`).
- **Hard cap nije bio garantovan** za ablation run (hard budget nije prosleđivan) i za run koji padne pre `run.json`.
- **Jsesc regresija** nije bila ponovljiva bez commit koraka (scope nije direktorijum u commit-u).

## Obaveze za Fazu 0 (pre prvog API poziva)

- [ ] commit zaključanog plana (PREREG + A1–A4 + lock v1.5);
- [ ] `hardBudget` fix u `scripts/ablation.mjs` + regresioni test (test-lock, autor = asistent);
- [ ] implementacija `scripts/final-budget.mjs` + `scripts/final-run.sh` sa A4 validacijom i 9 test slučajeva iz A4 §3 (uključiti `costUsd: 0, measured:false` i NaN/Infinity na validatoru — codex r6 preciziranje);
- [ ] verifikacija `.gitignore` (`git check-ignore`) i suvi test wrappera na mock runu ($0);
- [ ] deterministički kontrolni prolaz (Node 22/26, integrity, replay, score, demo, clean-clone ×2);
- [ ] prelazak na Fazu 1 (dogfood) — prvi stvarni API run.
