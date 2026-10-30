# Upstream status — prihvaćeni PR-ovi i issue-i (provera 30.10.2026)

> Izvod iz finalnog paketa dokumenata (30.10.2026).

Odgovor na pitanje iz zahteva: **„posebno me zanimaju prihvaćeni PR-ovi ili issue-i u tim repoima, ako ih ima."**

**Kratak odgovor: prihvaćenih (merged) nema.** Na dan 30.10.2026. nijedna prijava iz ove runde nije imala odgovor
maintainera, a nijedan povezani PR nije merge-ovan. Ima **3 nova issue-a otvorena 30.10.**, **2 nalaza su bila poznata
upstream pre naše analize** (duplikati — pošteno navedeni), **3 komentara** su ostavljena na postojeće prijave i **5 nalaza
nije prijavljeno**. Nezavisno od nas, na prijave iz ranije runde (v0.2.2) **drugi kontributori su otvorili fix PR-ove** —
ali su i oni **open i unmerged**, dakle „pokupio neko", ne „prihvaćeno".

## 1. Prijave iz finalne runde (F4) — 12 defekata u 5 novih repoa

| # | Repo / defekt | Veza | Status 30.10.2026 |
|---|---|---|---|
| 1 | mustache — cache `hasOwnProperty` shadowing (`mustache.js:397`) | [PR #854](https://github.com/janl/mustache.js/pull/854) (open), povezan [#856](https://github.com/janl/mustache.js/issues/856) | **već prijavljeno pre nas** (duplikat) — **komentar** sa nezavisnom potvrdom |
| 2 | mustache — kolizija keš ključa (`mustache.js:512`) | — | **neprijavljeno** |
| 3 | sax — `SGML_DECL_QUOTED` bez `parser.q` (`sax.js:1357-1371`) | [issue #303](https://github.com/isaacs/sax-js/issues/303) | **nov issue, otvoren 30.10.2026.** — bez odgovora maintainera |
| 4 | sax — `new Error(parser, …)` u mrtvoj grani (`sax.js:1797-1799`) | — | **neprijavljeno** (latentno, informational) |
| 5 | fast-json-patch — null deref `obj.toJSON` (`duplex.js:117-123`) | [issue #337](https://github.com/Starcounter-Jack/JSON-Patch/issues/337) | **nov issue, otvoren 30.10.2026.** — bez odgovora |
| 6 | fast-json-patch — `isInteger("")` (`helpers.js:64-77`) | root pokriven [PR #331](https://github.com/Starcounter-Jack/JSON-Patch/pull/331) (leading zero), ali prazan string nije | **komentar** na PR #331 sa manifestacijom; PR open/unmerged |
| 7 | fast-json-patch — observe prepisuje mirror baseline (`duplex.js:46-59`) | — | **neprijavljeno** (low) |
| 8 | fast-json-patch — `~~key` truncation (`core.js:214-220`) | — | **neprijavljeno** (low) |
| 9 | bcryptjs — `base64_decode` `c4 == -1` (`index.js:474-496`) | [PR #170](https://github.com/dcodeIO/bcrypt.js/pull/170) (open od 07.04.2026) | **već prijavljeno pre nas** (duplikat) — **komentar** sa nezavisnom, patch-proven potvrdom |
| 10 | bcryptjs — `hash()` ignoriše `genSalt` grešku (`index.js:172-176`) | — | **neprijavljeno** |
| 11 | bcryptjs — `genSalt` baca sinhrono (`index.js:112-118`) | — | **neprijavljeno** |
| 12 | dateformat — `yyyy` negativne godine (`src/dateformat.js:98-99`) | [issue #196](https://github.com/felixge/node-dateformat/issues/196) | **nov issue, otvoren 30.10.2026.** — bez odgovora |

**Rezime brojanja:** 2 već poznata upstream (duplikati) · 3 nova issue-a · 3 komentara na postojeće prijave · 5 neprijavljenih.
Nijedan nalaz nije predstavljen kao „novo otkriće" — svi javni commitovi su stariji od analize i tačan pin je naveden u prijavama.

## 2. Prijave iz ranije runde (v0.2.2, 28.10.2026) — 3 podneta izveštaja, sva tri dobila fix PR od drugih

Ovo je jedini deo gde postoji **spoljna reakcija** — ali opet: **fiksni PR-ovi su open i nisu merge-ovani**, i nisu ih otvorili
maintaineri nego drugi kontributori.

| Nalaz | Prijavljen | Fix PR (od drugih) | Status 29–30.10. |
|---|---|---|---|
| picomatch — unmatched `)` obara `state.parens` na -1 | [issue #243](https://github.com/micromatch/picomatch/issues/243) | [PR #245](https://github.com/micromatch/picomatch/pull/245) (Ekko82) — primenjuje guard predložen u prijavi **verbatim** i imenuje prijavljivača | **open, unmerged** |
| picomatch — `noext: true` briše i `isGlob` | [issue #242](https://github.com/micromatch/picomatch/issues/242) | [PR #244](https://github.com/micromatch/picomatch/pull/244) (junaidkhan80121) — `Closes #242` | **open, unmerged** |
| jsesc — nevalidni radix literali za negativne brojeve | [issue #79](https://github.com/mathiasbynens/jsesc/issues/79) | [PR #80](https://github.com/mathiasbynens/jsesc/pull/80) (fly1d) — pokriva frakcione/ne-konačne, negativni ceo broj ostaje za #73/#76 | **open, unmerged** |

**Šta ovo pokazuje:** nalazi su realni defekti koje su drugi developeri smatrali vrednim popravke, a izveštaji (uključujući
jednolinijske guardove) bili dovoljno konkretni da ih neko preuzme. **Šta ne pokazuje:** odobrenje projekta — PR-ovi su otvoreni.

## 3. Napomene koje idu uz status

- **Kontaminacija je moguća:** analizirani commitovi i upstream issue-i su javni i stariji od analize. Kod jsesc-a je tema
  (negativni radix) imala PR-ove (#73, #76) i pre naše prijave. Zato se nigde ne tvrdi „novo otkriće".
- **Dva duplikata su pošteno prijavljena** (mustache #854, bcryptjs #170) i nisu skrivana; u tabelama su označeni kao
  „već prijavljeno pre analize".
- **Nema odgovora maintainera** — ni odobrenja, ni odbijanja — na dan 30.10.2026. Zato je tačan status „podneto / pokupljeno",
  ne „prihvaćeno".
- **Nezavisna verifikacija (F5) je ovo proverila** i ispravila prvobitnu tvrdnju: 2 od 12 F4 nalaza su duplikati i
  mustache F-001 je prvobitno pogrešno ocenjen (ispravljeno). Detalj: `01-rezultati-pravi-repoi/F5-VERIFICATION.md` §4 i
  `01-rezultati-pravi-repoi/F4-real-world.md` §4b.

## 4. Izvori

- `01-rezultati-pravi-repoi/F4-real-world.md` §4b/§4c (tabela svih 12 + ispravka hand-checka)
- `01-rezultati-pravi-repoi/README-finalne-runde.md` §4d
- `../HISTORY.md`, sekcija „Upstream impact (qualitative)" (v0.2.2 PR-ovi)
- `01-rezultati-pravi-repoi/README-finalne-runde.md` §6 (ograničenja: „nijedna prijava još nema odgovor maintainera")
