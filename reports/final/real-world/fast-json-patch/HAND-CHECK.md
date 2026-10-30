# HAND-CHECK — fast-json-patch

**Repo:** https://github.com/Starcounter-Jack/JSON-Patch @ `9d313ac01916e525e9204074f06e5295edec491b` · scope `commonjs` (3 f./803 LOC)
**Runs:** `4e12c16371305216` ($0.2514, 1 verified), `4e12c16371305216-2` ($0.4997, 3 verified)
**Method:** reading the code in the clone at the pinned commit.

| Run / ID | Claim | Verdict | Severity | Evidence |
|---|---|---|---|---|
| run1 F-001 `duplex.js:117-123` | `_generate` dereferences `obj.toJSON` without a null check | **REAL — new, reported upstream** | **medium-low** | `if (obj === mirror) return;` then `typeof obj.toJSON === "function"` — when `obj` is `null` (JSON null document/value), `typeof null.toJSON` throws TypeError instead of generating a `replace` patch. Confirmed repro: `jsonpatch.compare({a:1}, null)` → `TypeError: Cannot read properties of null (reading 'toJSON')`. **Not the same as #318** (that is a mirror/object toJSON asymmetry). **Reported 30 Oct 2026:** [issue #337](https://github.com/Starcounter-Jack/JSON-Patch/issues/337). |
| run2 F-001 `helpers.js:64-77` | `isInteger("")` returns true | **REAL — partially covered by an existing PR** | **low-medium** | `len=0` → the `while` loop does not run → `return true`; in `core.js:218` `~~""` = 0, so an empty array key becomes index 0 instead of invalid. Same **root** as [PR #331](https://github.com/Starcounter-Jack/JSON-Patch/pull/331) (leading zero), but that report does not cover the empty string; a comment was left on PR #331 on 30 Oct 2026 with the manifestation and a proposed canonical index validation. |
| run2 F-002 `duplex.js:46-59` | A second `observe` overwrites the shared mirror baseline | **REAL** | **medium-low** | `mirror.value = _deepClone(obj)` runs for every new observer of the same object; existing observers that did not produce changes lose their baseline. |
| run2 F-004 `core.js:214-220` | `~~key` truncation for large indices | **REAL** | **low** | `~~` converts to a 32-bit signed int; indices > 2^31 wrap and address the wrong element or pass the bounds check. |

**Final:** 4 real defects, all confirmed statically; none has execution proof (L3 `inconclusive` — the generated repro did not pass L0). **Upstream status (30 Oct):** F-001 new → [issue #337](https://github.com/Starcounter-Jack/JSON-Patch/issues/337); isInteger root → comment on [PR #331](https://github.com/Starcounter-Jack/JSON-Patch/pull/331); F-002 (observe mirror) and F-004 (`~~key`) **not reported** (trackers checked).
