# Ručna validacija nalaza — pregled (najvažniji dokument)

> Izvod iz finalnog paketa dokumenata (30.10.2026). Originalni HAND-CHECK fajlovi su u [reports/final/real-world/](../reports/final/real-world/) (po repou); sirovi runovi su u istom stablu.

Ovo je sumarni pregled **ručne adjudikacije** svih nalaza iz finalne runde (F4, 29–30.10.2026).
Izvor su originalni `HAND-CHECK.md` fajlovi (8 komada, kopije su u ovom folderu i u `../reports/final/real-world/<repo>/`),
`run.json`/`findings.json` pojedinačnih runova i `F4-real-world.md` §4.

**Kratak odgovor na pitanje iz zahteva:** od nalaza koji su prošli **obe kapije** (L1 citat + L2 adversarialno potvrđivanje),
**21 od 21 objavljenih unosa je ručno provereno**; **20 je potvrđeno kao stvarno stanje koda**, a **1 je lažni pozitiv**
(sax F-002) — dakle **1/21 ≈ 4,8%** lažnih pozitiva na nivou objavljenih unosa, i to je jedini zabeležen lažni pozitiv u celoj rundi.
Uz to su 2 unosa označena kao **latentna/mrtav kod** (informational, ne user-visible defekt) i 1 **uncertain** nalaz
(jsesc F-002) koji je ručno potvrđen kao stvaran ali nije objavljen kao `verified`.
**Nijedan PR ni issue nije prihvaćen/merge-ovan** — vidi `UPSTREAM-STATUS.md`.

> Napomena o broju „24" iz finalnih dokumenata: `F4-real-world.md` §4 i `reports/final/README.md` govore o
> „24 published unosa ručno provereno" (16 iz novih repoa + 8 iz regresije, po njihovom brojanju; uključuje
> ponovljene nalaze iz dva runa). Ovaj pregled polazi od **pojedinačnih unosa u `findings.json`**: 21 `verified`
> unos u 13 runova + 1 `uncertain` = **22 unosa** koji su ručno adjudikovani. Oba brojanja pokrivaju isti skup
> repoa i runova; razlika je samo u tome šta se broji kao „unos" (nalaz po runu vs. jedinstveni defekt).

## Metod

- Svaki objavljeni nalaz pročitan je **u klonu na pinovanom commitu** (ne u modelovom opisu).
- Gde je run dao izvršni dokaz (`repro`/`patch`), adjudikacija se oslanja na njega; gde nije, provera je statička.
- Ocena po nalazu: **STVARAN / NIJE DEFEKT / LATENTAN / UNCERTAIN**, sa ručnom težinom (scanner težina nije prihvaćena automatski).
- Urađeno je i **ponovno čitanje posle nezavisne provere (F5)**: jednoj oceni je ispravljena greška (mustache F-001), i to je
  dokumentovano, a ne prepravljeno tiho.

## 1. Zbirno po repou

| Repo | Pin | Runova | Verified unosa | Ručni ishod | Od toga jedinstvenih defekata | Upstream |
|---|---|---:|---:|---|---:|---|
| mustache | `972fd2b2` | 2 | 3 | 2 defekta potvrđena (F-001 tačan, adjudikacija ispravljena; F-002 stvaran) | 2 | F-001 **već prijavljen** (PR #854), F-002 neprijavljen |
| sax | `961ceeef` | 2 | 4 | 2 stvarna (F-001, F-003 latenta) + **1 odbačen** (F-002, by design) | 2 | F-001 **nov issue #303**; F-003 nije prijavljen (mrtva grana) |
| fast-json-patch | `9d313ac0` | 2 | 4 | 4 stvarna (F-001, F-002/„isInteger“, F-002/observe, F-004 `~~key`) | 4 | F-001 **nov issue #337**; isInteger → komentar na PR #331; 2 neprijavljena |
| bcryptjs | `1211e9a2` | 2 | 4 | 3 stvarna (F-003/base64 u oba runa; F-001; F-002); 1 **patch-proven** | 3 | F-003 **već prijavljen** (PR #170); 2 neprijavljena |
| dateformat | `e6800aa9` | 2 | 1 | 1 stvaran (F-001, nizak uticaj); run1 = 0 nalaza | 1 | F-001 **nov issue #196** |
| **novi repoi — ukupno** | | **10** | **16** | **14 stvarnih unosa + 1 latentan + 1 odbačen** | **12** | 2 duplikata + 3 nova issue-a + 3 komentara + 5 neprijavljenih |
| picomatch (regresija) | `6bb40679` | 1 | 1 | 1 stvaran, **patch-proven** (ponovljen defekt iz v0.2.2) | 1 | nije prijavljivan u ovoj rundi |
| jsesc (regresija) | `e3349b54` | 1 | 2 | 2 stvarna (F-001 **patch-proven**, F-003 mrtav kod) + 1 uncertain ručno potvrđen (F-002) | 2 (+1 mrtav kod) | jsesc #79 (već prijavljen), PR #80 delimičan |
| jsesc dual (regresija) | `e3349b54` | 1 | 2 | 2 patch-proven unosa = **1 root cause** (duplikat prijavljen pošteno) | 1 | isto (jsesc #79) |
| **regresija — ukupno** | | **3** | **5 (+1 uncertain)** | **5 stvarnih** (2 root cause-a) | **3** | — |

**Ukupno:** 21 verified unosa + 1 uncertain = **22 ručno adjudikovana unosa**; **1 lažni pozitiv**; **2 latentna/mrtva koda**;
**2 nalaza su bila poznata upstream pre runde** (ne predstavljaju se kao nova otkrića).

## 2. Detaljna adjudikacija (svi nalazi)

| Repo | Nalaz (run/ID) | Citat | Tvrdnja (kratko) | Ručna ocena | Težina | Dokaz | Upstream |
|---|---|---|---|---|---|---|---|
| mustache | run1+run2 F-001 | `mustache.js:397` | `cache.hasOwnProperty(name)` — keširanje imena `hasOwnProperty` obori metodu i drugi lookup baca `TypeError` | **STVARAN — tačan** (prva ocena grešila, ispravljena) | low-medium | statički + nezavisno potvrđeno upstream | **PR #854** (open) + komentar |
| mustache | run1 F-002 | `mustache.js:512` | cache ključ `template + ':' + tags.join(':')` kolizira za tagove sa dvotačkom | **STVARAN** | low | statički | neprijavljen |
| sax | run1+run2 F-001 | `sax.js:1357-1371` | `SGML_DECL_QUOTED` se otvara bez postavljanja `parser.q`, pa quoted SGML deklaracija ne izlazi iz stanja | **STVARAN** | low-medium | statički + repro stanja | **nov issue #303** |
| sax | run2 F-002 | `sax.js:1609-1615` | valueless atribut preskače xmlns obradu | **NIJE DEFEKT (by design)** — **lažni pozitiv** | — | čitanje XML spec-a; verifikator ga je potvrdio | — |
| sax | run2 F-003 | `sax.js:1797-1799` | `new Error(parser, …)` u nedostižnoj grani | **LATENTAN** (mrtav kod) | informational | statički | ne prijavljujemo |
| fast-json-patch | run1 F-001 | `duplex.js:117-123` | `obj.toJSON` bez null provere → `TypeError` za `null` | **STVARAN** | medium-low | repro u hand-check-u | **nov issue #337** |
| fast-json-patch | run2 F-001 | `helpers.js:64-77` | `isInteger("")` vraća true | **STVARAN** (root pokriven delimično) | low-medium | statički | komentar na PR #331 |
| fast-json-patch | run2 F-002 | `duplex.js:46-59` | drugi `observe` prepisuje shared mirror baseline | **STVARAN** | medium-low | statički | neprijavljen |
| fast-json-patch | run2 F-004 | `core.js:214-220` | `~~key` truncation za indekse > 2^31 | **STVARAN** | low | statički | neprijavljen |
| bcryptjs | run1 F-003 + run2 F-001 | `index.js:474-496` | `base64_decode` ne proverava `c4 == -1` pre OR | **STVARAN — patch-proven u oba runa** | medium | izvršni (reproduced+patch 3/3) | **PR #170** (open) + komentar |
| bcryptjs | run1 F-001 | `index.js:172-176` | `hash()` ignoriše `genSalt` grešku | **STVARAN** | medium-low | statički | neprijavljen |
| bcryptjs | run1 F-002 | `index.js:112-118` | `genSalt` baca sinhrono za ne-number rounds | **STVARAN** | low | statički | neprijavljen |
| dateformat | run2 F-001 | `src/dateformat.js:98-99` | `yyyy` ne obrađuje negativne godine (`"00-1"`) | **STVARAN** | low / informational | potvrđen repro | **nov issue #196** |
| picomatch (reg.) | F-001 | `lib/scan.js:390-394` | trailing token se ne postavi kad je poslednji slash na indeksu 0 | **STVARAN — patch-proven** | medium-low | izvršni 3/3 | već objavljen u v0.2.2 (re-confirmed) |
| jsesc (reg.) | F-001 | `jsesc.js:216-225` | negativni brojevi u hex/bin/oct daju `0x-A` | **STVARAN — patch-proven** | medium | izvršni 3/3 | jsesc #79 (open) |
| jsesc (reg.) | F-002 | `jsesc.js:214-226` | nepoznata `numbers` opcija → `undefined` | **STVARAN, ručno potvrđen** (sistem ostavio `uncertain`) | low | statički | neprijavljen |
| jsesc (reg.) | F-003 | `jsesc.js:203` | drugi `isBigInt` branch je mrtav | **STVARAN (mrtav kod)** | informational | statički | neprijavljen |
| jsesc dual (reg.) | F-001 + F-002 | `jsesc.js:221` / `:216-225` | negativni radix literali (dve tvrdnje, jedan root cause) | **STVARAN — patch-proven oba** | medium | izvršni 3/3 | jsesc #79 |

## 3. Lažni pozitiv koji je prošao oba modela — sax F-002

Ovo je najvažniji pojedinačni podatak za pitanje „koliko su lažni pozitivi prošli obe kapije".

- **Nalaz:** valueless atribut u `ATTRIB_NAME_SAW_WHITE` preskače `attrib()` i xmlns obradu (`sax.js:1609-1615`).
- **Kapi:** L1 citat je prošao (citat postoji, tačan), **verifikator ga je potvrdio** (`confirm`) — dakle oba **modela** su bila za.
- **Ručna ocena:** **nije defekt.** XML spec: xmlns deklaracija mora imati vrednost; valueless atribut se ispravno tretira kao
  `strictFail('Attribute without value')` + običan atribut sa `""`. Nema namespace efekta koji bi se „preskočio".
- **Zaključak:** mehanizam (citat + adversarialno potvrđivanje) **nije garant istine**; ovo je 1 lažni pozitiv u 21 objavljenom
  unosu finalne runde. Dokumentacija to i tvrdi („semantic tie is a human review, not a machine proof").
  Verifikator je pogrešio jer nije uzeo u obzir XML pravilo o obaveznom `=` za xmlns — model nije imao taj domen znanja.

## 4. Slučaj gde je ručna provera prvo pogrešila — mustache F-001

Prvobitni hand-check je tvrdio da do upisa u keš ne dolazi i da nema `TypeError`-a. Posle nezavisne provere (F5, §4)
ocena je **ispravljena**: prvi lookup za `hasOwnProperty` pada u `else` granu (nasleđena metoda nije *own* property keša),
vrednost se upisuje u keš; **drugi** lookup baca `TypeError: cache.hasOwnProperty is not a function`.
Originalna tvrdnja iz runa je **tačna**, a upstream PR #854 je nezavisno potvrđuje.

Ovo je namerno ostavljeno u dokumentaciji: ručna adjudikacija nije nepogrešiva, ali je ispravljena javno i sa dokazom
(`F4-real-world.md` §4c, `F5-VERIFICATION.md` §4).

## 5. Šta se iz ovog skupa može i ne može tvrditi

**Može:**
- 21 objavljenih unosa, 1 lažni pozitiv (4,8%), 0 neadjudikovanih; 1 nalaz je i izvršno dokazan (bcryptjs, patch-proven u oba runa).
- Verifikator u F4 **nije odbio nijedan** nalaz (0 `refuted`), pa u ovoj rundi nema ni lažne refutacije — ali nema ni dokaza da
  L2 odbija lažne pozitive (jedini lažni pozitiv je prošao kroz njega). Za to vidi istorijske slučajeve u `../reports/final/`.
- 2 nalaza su bila poznata upstream pre analize i tako su označeni; nijedan se ne predstavlja kao novo otkriće.

**Ne može:**
- „0 lažnih pozitiva" — nije tačno; **1** je tu i eksplicitno je prijavljen.
- „prihvaćeno upstream" — nijedna prijava nema odgovor maintainera na dan 30.10.2026 (status: podneto; 3 nova issue-a otvorena,
  2 duplikata, 3 komentara; nekoliko je nezavisno pokupilo PR-ove drugih ljudi, ali nijedan nije merge-ovan).
- „merenje tačnosti" — n = mali (21 unos, 8 pinova); javni commitovi → kontaminacija moguća. Ovo je anegdota sa dokazima, ne benchmark.

## 6. Istorijski kontekst (van finalne runde)

Da odgovor ne bude samo F4: u ranijim rundama ručno je proveren još jedan skup nalaza (izvori: `../HISTORY.md`,
`../reports/README.md`, pojedinačni `HAND-CHECK.md`):

| Runda | Ručno provereno | Ishod |
|---|---|---|
| v0.2.2 real-world sample (10 repoa, 23 runa) | 17 jedinstvenih verified nalaza | **17 potvrđeno, 0 odbačeno**; 9 mašinski dokazano |
| ofetch (real repo, 2 runa) | 4 verified | **4/4 odgovara open upstream issue/PR** |
| probe runde (defu, p-queue, zustand, yup; semver, dotenv, json5, ufo, validator) | 4 + 4 hand-confirmed (od 6 + 10 objavljenih) | bez potvrđenih lažnih pozitiva u onome što je provereno |
| dogfood (CodeProof na sopstvenom `src/`) | 6 kandidata → 5 verified + 1 uncertain | **5 stvarnih popravljeno + regresioni testovi; 1 nije defekt; 0 lažnih** |
| controlled verifier test | 1 namerno lažan kandidat | **odbijen** jakim refute-om sa mašinski proverenim kontra-citatom |

**Sabirno kroz sve runde:** jedini potvrđen lažni pozitiv koji je prošao oba modela je **sax F-002 iz F4**;
nijedan potvrđen slučaj **lažne refutacije** (verifier oborio pravi bug) u zapisu — najbliži je swr F-004 koji je
„delimično refuted" (vidi istorijske `rejected.md` fajlove u `../reports/final/real-world/` i evidence index `../reports/README.md`).

## 7. Gde su originali

| Fajl u ovom folderu | Original u repozitorijumu |
|---|---|
| `mustache-HAND-CHECK.md` | `../reports/final/real-world/mustache/HAND-CHECK.md` |
| `sax-HAND-CHECK.md` | `../reports/final/real-world/sax/HAND-CHECK.md` |
| `fast-json-patch-HAND-CHECK.md` | `../reports/final/real-world/fast-json-patch/HAND-CHECK.md` |
| `bcryptjs-HAND-CHECK.md` | `../reports/final/real-world/bcryptjs/HAND-CHECK.md` |
| `dateformat-HAND-CHECK.md` | `../reports/final/real-world/dateformat/HAND-CHECK.md` |
| `regresija/*-HAND-CHECK.md` | `../reports/final/real-world/{picomatch-regression,jsesc-regression,jsesc-dual-r2}/HAND-CHECK.md` |

Svi fajlovi su **bajt-identične kopije**; jedino su preimenovani da bi se odmah videlo koji je repo u pitanju.
