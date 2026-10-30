# HAND-CHECK — sax

**Repo:** https://github.com/isaacs/sax-js @ `961ceeefcc5186005466f2085aeb36f31b161e37` · scope `lib` (1 f./1866 LOC)
**Runs:** `86ed5667b2ec15cc` ($0.3164, 1 verified), `86ed5667b2ec15cc-2` ($0.8008, 3 verified)
**Method:** reading the code in the clone at the pinned commit.

| Run / ID | Claim | Verdict | Severity | Evidence |
|---|---|---|---|---|
| run1 F-001, run2 F-001 (same defect) `sax.js:1357-1371` | `SGML_DECL_QUOTED` is entered without setting `parser.q` | **REAL — new, reported upstream** | **low-medium** | `isQuote(c)` → `parser.state = S.SGML_DECL_QUOTED` and `parser.sgmlDecl += c`, but `parser.q` stays `''`; the exit test `c === parser.q` is never true → a quoted SGML declaration never leaves the state (the parser gets stuck). Repro: `parser.write('<!ENTITY "x"> <a></a>')` → no events, state 6, `q=""`. Affects only quoted SGML declarations (rare). **Reported 30 Oct 2026:** [issue #303](https://github.com/isaacs/sax-js/issues/303). |
| run2 F-002 `sax.js:1609-1615` | Valueless attribute skips xmlns/attribList handling | **NOT A DEFECT (by design) — manually rejected** | — | XML spec: an xmlns declaration must have a value; a valueless attribute is correctly treated as `strictFail('Attribute without value')` + a plain `""` attribute; there is no namespace effect being skipped. The verifier (`confirm`) did not account for the fact that a valueless attribute cannot be a namespace declaration. **1 false-positive finding in the F4 set — reported, not hidden.** |
| run2 F-003 `sax.js:1797-1799` | `default:` state constructs `new Error(parser, 'Unknown state: …')` | **LATENT (unreachable branch)** | **informational** | The branch is marked `/* istanbul ignore next */`; if ever reached, `parser` as the first argument produces `"[object Object]"` and the `state` is lost. No effect on normal operation. |

**Final:** 2 real defects (F-001 `low-medium`, F-003 `informational`), **1 manually rejected** (F-002). No execution proof (L3 `inconclusive`). **Upstream status (30 Oct):** F-001 new → [issue #303](https://github.com/isaacs/sax-js/issues/303) (with a proposed one-line fix `parser.q = c`); F-003 not reported (unreachable branch, informational).
