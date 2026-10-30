# HAND-CHECK — dateformat

**Repo:** https://github.com/felixge/node-dateformat @ `e6800aa902fcbd523d5ea06a9a79050878cfa48e` · scope `.` (43 f./2085 LOC)
**Runovi:** `fead8f9fa0544305` ($0,0717, **0 nalaza**), `fead8f9fa0544305-2` ($0,1945, 1 verified)
**Način provere:** čitanje koda u klonu na pinovanom commitu.

| Run / ID | Tvrdnja | Ocena | Težina | Provera |
|---|---|---|---|---|
| run2 F-001 `src/dateformat.js:98-99` | `yyyy` ne obrađuje negativne godine | **STVARAN — nov, prijavljen upstream** | **low / informational** | `yy: () => pad(Math.abs(y()), 2).slice(-2)` koristi `Math.abs`, ali `yyyy: () => pad(y(), 4)` ne: `String(-1).padStart(4,'0') = "00-1"` (minus u sredini). Pogađa istorijske datume (pre 1. godine); normalni datumi nisu pogođeni. Potvrđen repro: `dateFormat(new Date(-1,0,1), "yyyy")` → `"00-1"`. **Prijavljeno 30.10.2026:** [issue #196](https://github.com/felixge/node-dateformat/issues/196). |

**Konačno:** 1 stvaran defekt, nizak uticaj; **prijavljen upstream 30.10.2026** ([issue #196](https://github.com/felixge/node-dateformat/issues/196)). **0-nalaza run je prijavljen kao takav** (run1 0 proposed — model nije našao ništa, ne skriva se).
