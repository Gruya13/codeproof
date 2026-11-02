# Upstream reports — status (post-freeze exploratory round)

All reports below were filed from findings the pipeline produced, and every one was **independently checked against the
current (HEAD) code** before filing. Nothing here is a claim that a maintainer accepted the report — the status column
is the GitHub state at the time of writing.

## 1. Filed in the final round (F4, 28–30 Oct 2026)

| Issue | Repository | Title | Filed | Status |
|---|---|---|---|---|
| [#242](https://github.com/micromatch/picomatch/issues/242) | micromatch/picomatch | `noext: true` sets `isGlob` to `false` for every pattern | 2026-10-28 | open |
| [#243](https://github.com/micromatch/picomatch/issues/243) | micromatch/picomatch | An unmatched `)` drives `state.parens` to -1 | 2026-10-28 | open |
| [#79](https://github.com/mathiasbynens/jsesc/issues/79) | mathiasbynens/jsesc | `numbers` mode produces invalid literals for negative/fractional values | 2026-10-28 | open |
| [#337](https://github.com/Starcounter-Jack/JSON-Patch/issues/337) | Starcounter-Jack/JSON-Patch | `compare()` throws on a null value instead of producing a replace patch | 2026-10-30 | open |
| [#196](https://github.com/felixge/node-dateformat/issues/196) | felixge/node-dateformat | `yyyy` token produces "00-1" for negative years | 2026-10-30 | open |
| [#303](https://github.com/isaacs/sax-js/issues/303) | isaacs/sax-js | SGML declaration with a quoted value never closes | 2026-10-30 | open |

Plus comments on existing reports (independent confirmation, not new issues): mustache
[#854](https://github.com/janl/mustache.js/issues/854), bcrypt
[PR #170](https://github.com/dcodeIO/bcrypt.js/pull/170), fast-json-patch
[PR #331](https://github.com/Starcounter-Jack/JSON-Patch/pull/331).

## 2. Filed from this exploratory round (2 Nov 2026)

Every issue below was reproduced mechanically against the current HEAD of the library before filing; the repro code is
in the issue body. The reproduction scripts and the full check record are in [C-REALWORLD.md](C-REALWORLD.md) and [issues/](issues/)
and [C-REALWORLD.md](C-REALWORLD.md).

| Issue | Repository | Title | Finding |
|---|---|---|---|
| [#59](https://github.com/jridgewell/sourcemaps/issues/59) | jridgewell/sourcemaps | `encodeOriginalScopes/decodeOriginalScopes` round-trip breaks with >1 top-level scope | sourcemap-codec F-001 |
| [#60](https://github.com/jridgewell/sourcemaps/issues/60) | jridgewell/sourcemaps | `encodeGeneratedRanges` binding column base not reset on line change | sourcemap-codec F-003 |
| [#338](https://github.com/Starcounter-Jack/JSON-Patch/issues/338) | Starcounter-Jack/JSON-Patch | Removing a non-index array property splices the wrong element | fjp round-2 |
| [#339](https://github.com/Starcounter-Jack/JSON-Patch/issues/339) | Starcounter-Jack/JSON-Patch | `generate()` duplicate root replaces + stale mirror after toJSON type change | fjp F-002 (F4) |
| [#340](https://github.com/Starcounter-Jack/JSON-Patch/issues/340) | Starcounter-Jack/JSON-Patch | Falsy documents skip validation → raw TypeError | fjp round-2 |
| [#4375](https://github.com/vercel/swr/issues/4375) | vercel/swr | `INITIAL_CACHE` is module-global, snapshots leak between caches | swr round-2 |
| [#4376](https://github.com/vercel/swr/issues/4376) | vercel/swr | `INITIAL_CACHE` `in` check matches Object.prototype keys | swr round-2 — **fix PR [#4377](https://github.com/vercel/swr/pulls/4377) opened by @roux-lon** |

Note: `jridgewell/sourcemap-codec` is archived; development moved to the `jridgewell/sourcemaps` monorepo, and both
findings reproduce on monorepo `main` at 1.6.0 (b760015), so they were filed there.

## 3. Verified but not filed (with reasons)

| Candidate | Repository | Why not filed |
|---|---|---|
| `~~key` truncation for indices > 2^31 | fast-json-patch | real corruption, but indices that large are unrealistic; "won't fix" risk |
| root `copy` returns a live reference | fast-json-patch | RFC 6902 does not require cloning; could be by design |
| `getPath(root, root)` returns `"/"` | fast-json-patch | `getPath` is not documented → internal helper |
| `mergeHeaders({x: undefined}, {})` → `"undefined"` | ky | documented type allows `undefined`, but the scenario is rare |
| `scan('!!foo').negated` inconsistency | picomatch | public API but `scan` is not in the README; maintainer may call it low-level |
| `basename('')` returns `undefined` | picomatch | internal util, minor |
| `render(template, null)` throws | mustache | whole-view null is not covered by the spec; minor |
| dotted names context precedence | mustache | **already reported upstream: #846 (open)** — not filed again |

## 4. Follow-up (as of 2026-11-02)

- **#4376 (swr)**: contributor @roux-lon replied the same day and opened
  [PR #4377](https://github.com/vercel/swr/pulls/4377) — `INITIAL_CACHE` becomes a `Map` and the `in` checks become
  `.has()`/`.get()`; a new `test/unit/cache-helper.test.ts` covers the prototype keys. The PR is open
  (`mergeable: true`, `mergeable_state: blocked` — waiting on review/CI at the time of writing). **This fixes the
  prototype collision, but not #4375**: `INITIAL_CACHE` stays module-global, so the cross-cache leak is still open.
- **#4375 (swr)**: no replies yet. Different root cause (per-cache storage), not covered by #4377.
- All other 11 issues (6 from the final round + 5 from this round): no replies yet.

## 5. Summary

- **13 issues filed in total** (6 in the final round + 7 from this round), all open as of 2026-11-02.
- **3 comments** on existing upstream reports.
- **8 verified candidates held back** (7 for risk/noise, 1 duplicate of #846).
- None of the new reports claims a maintainer response or a merge; the table is a record of what was filed, not of
  what was accepted.
