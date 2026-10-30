# HAND-CHECK — sax

**Repo:** https://github.com/isaacs/sax-js @ `961ceeefcc5186005466f2085aeb36f31b161e37` · scope `lib` (1 f./1866 LOC)
**Runovi:** `86ed5667b2ec15cc` ($0,3164, 1 verified), `86ed5667b2ec15cc-2` ($0,8008, 3 verified)
**Način provere:** čitanje koda u klonu na pinovanom commitu.

| Run / ID | Tvrdnja | Ocena | Težina | Provera |
|---|---|---|---|---|
| run1 F-001, run2 F-001 (isti defekt) `sax.js:1357-1371` | `SGML_DECL_QUOTED` se otvara bez postavljanja `parser.q` | **STVARAN — nov, prijavljen upstream** | **low-medium** | `isQuote(c)` → `parser.state = S.SGML_DECL_QUOTED` i `parser.sgmlDecl += c`, ali `parser.q` ostaje `''`; izlazni test `c === parser.q` nikad nije tačan → quoted SGML deklaracija ne izlazi iz stanja (parser se zaglavi). Repro: `parser.write('<!ENTITY "x"> <a></a>')` → nijedan događaj, stanje 6, `q=""`. Utiče samo na SGML deklaracije sa navodnicima (retko). **Prijavljeno 30.10.2026:** [issue #303](https://github.com/isaacs/sax-js/issues/303). |
| run2 F-002 `sax.js:1609-1615` | Valueless atribut preskače xmlns/attribList obradu | **NIJE DEFEKT (by design) — ručno odbačen** | — | XML spec: xmlns deklaracija mora imati vrednost; valueless atribut se ispravno tretira kao `strictFail('Attribute without value')` + običan atribut `""`; nema namespace efekta koji bi se preskočio. Verifikator (`confirm`) nije uzeo u obzir da valueless ne može biti namespace deklaracija. **1 lažno pozitivan nalaz u F4 skupu — prijavljen, ne skriven.** |
| run2 F-003 `sax.js:1797-1799` | `default:` state konstruiše `new Error(parser, 'Unknown state: …')` | **LATENTAN (nedostižna grana)** | **informational** | Grana je označena `/* istanbul ignore next */`; ako se ikad dostigne, `parser` kao prvi argument daje `"[object Object]"` i gubi se `state`. Nema uticaja na normalan rad. |

**Konačno:** 2 stvarna defekta (F-001 `low-medium`, F-003 `informational`), **1 odbačen ručno** (F-002). Nema izvršnog dokaza (L3 `inconclusive`). **Upstream status (30.10.):** F-001 nov → [issue #303](https://github.com/isaacs/sax-js/issues/303) (sa predlogom jednolinijskog fixa `parser.q = c`); F-003 ne prijavljujemo (nedostižna grana, informational).
