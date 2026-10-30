# HAND-CHECK — mustache

**Repo:** https://github.com/janl/mustache.js @ `972fd2b27a036888acfcb60d6119317744fac7ee` · scope `.` (80 f./2402 LOC)
**Runs:** `4d11c6d684b65418` ($0.4756, 2 verified), `4d11c6d684b65418-2` ($0.4067, 1 verified)
**Method:** reading the code in the clone at the pinned commit (`_repo/`).

| Run / ID | Claim | Verdict | Severity | Evidence |
|---|---|---|---|---|
| run1 F-001, run2 F-001 (same defect) `mustache.js:397` | `Context.lookup` uses `cache.hasOwnProperty(name)`; caching the name `hasOwnProperty` breaks the method and the next lookup throws TypeError | **REAL — claim correct** | **low-medium** | `this.cache = {'.': view}` (plain object). First `{{hasOwnProperty}}`: `cache.hasOwnProperty("hasOwnProperty")` is `false` (an inherited method is not an own property of the cache) → `else` branch → `cache["hasOwnProperty"] = value` (line 467). Second lookup of the same name: `cache.hasOwnProperty` is now the value, not a function → **`TypeError: cache.hasOwnProperty is not a function`**. Same for `toString`/`valueOf`/`constructor`. **Correction of the previous adjudication:** the first verdict wrongly claimed that no cache write happens and that there is no TypeError — the write happens and the TypeError is real. Independently confirmed and **already reported upstream**: [mustache PR #854](https://github.com/janl/mustache.js/pull/854) (open; + linked [#856](https://github.com/janl/mustache.js/issues/856) for prototype-chain names); a comment with independent confirmation was left on 30 Oct 2026. |
| run1 F-002 `mustache.js:512` | Cache key `template + ':' + tags.join(':')` collides | **REAL** | **low** | Logical analysis: template `"foo:bar"` + tags `["baz","qux"]` and template `"foo"` + tags `["bar:baz","qux"]` produce the same key `foo:bar:baz:qux`; a collision requires custom tags that contain `:`. |

**Final:** 2 unique defects, both confirmed; F-001 is **correct** (TypeError on the second lookup) and **already reported upstream** (PR #854) — not a new finding; hand-assigned severity **low-medium**. F-002 (cache-key collision) was not reported upstream. No execution proof (L3 `inconclusive` — mustache is UMD across multiple files, the repro did not get there).
