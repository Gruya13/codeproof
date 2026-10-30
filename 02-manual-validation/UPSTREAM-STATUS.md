# Upstream status — accepted PRs and issues (checked 30 Oct 2026)

> Excerpt from the final evidence package (30 Oct 2026).

Answer to the question asked: **"I am particularly interested in accepted PRs or issues in those repos, if any."**

**Short answer: none were merged.** On 30 Oct 2026 no report from this round had a maintainer response, and no related PR
was merged. There are **3 new issues opened on 30 Oct**, **2 findings were already known upstream before our analysis**
(duplicates — stated honestly), **3 comments** were left on existing reports, and **5 findings were not reported**.
Independently of us, other contributors opened fix PRs for the reports from the earlier round (v0.2.2) — but those are
**open and unmerged** too, i.e. "someone picked it up", not "accepted".

## 1. Reports from the final round (F4) — 12 defects in 5 new repositories

| # | Repo / defect | Link | Status 30 Oct 2026 |
|---|---|---|---|
| 1 | mustache — cache `hasOwnProperty` shadowing (`mustache.js:397`) | [PR #854](https://github.com/janl/mustache.js/pull/854) (open), linked [#856](https://github.com/janl/mustache.js/issues/856) | **already reported before us** (duplicate) — **comment** with independent confirmation |
| 2 | mustache — cache key collision (`mustache.js:512`) | — | **unreported** |
| 3 | sax — `SGML_DECL_QUOTED` without `parser.q` (`sax.js:1357-1371`) | [issue #303](https://github.com/isaacs/sax-js/issues/303) | **new issue, opened 30 Oct 2026** — no maintainer response |
| 4 | sax — `new Error(parser, …)` in a dead branch (`sax.js:1797-1799`) | — | **unreported** (latent, informational) |
| 5 | fast-json-patch — null deref `obj.toJSON` (`duplex.js:117-123`) | [issue #337](https://github.com/Starcounter-Jack/JSON-Patch/issues/337) | **new issue, opened 30 Oct 2026** — no response |
| 6 | fast-json-patch — `isInteger("")` (`helpers.js:64-77`) | root covered by [PR #331](https://github.com/Starcounter-Jack/JSON-Patch/pull/331) (leading zero), but the empty string is not | **comment** on PR #331 with the manifestation; PR open/unmerged |
| 7 | fast-json-patch — observe overwrites the mirror baseline (`duplex.js:46-59`) | — | **unreported** (low) |
| 8 | fast-json-patch — `~~key` truncation (`core.js:214-220`) | — | **unreported** (low) |
| 9 | bcryptjs — `base64_decode` `c4 == -1` (`index.js:474-496`) | [PR #170](https://github.com/dcodeIO/bcrypt.js/pull/170) (open since 7 Apr 2026) | **already reported before us** (duplicate) — **comment** with independent, patch-proven confirmation |
| 10 | bcryptjs — `hash()` ignores the `genSalt` error (`index.js:172-176`) | — | **unreported** |
| 11 | bcryptjs — `genSalt` throws synchronously (`index.js:112-118`) | — | **unreported** |
| 12 | dateformat — `yyyy` negative years (`src/dateformat.js:98-99`) | [issue #196](https://github.com/felixge/node-dateformat/issues/196) | **new issue, opened 30 Oct 2026** — no response |

**Count summary:** 2 already known upstream (duplicates) · 3 new issues · 3 comments on existing reports · 5 unreported.
No finding is presented as a "new discovery" — all public commits predate the analysis, and the exact pin is stated in the reports.

## 2. Reports from the earlier round (v0.2.2, 28 Oct 2026) — 3 reports filed, all three received a fix PR from others

This is the only place with **external reaction** — but again: **the fix PRs are open and not merged**, and they were opened by
other contributors, not by the maintainers.

| Finding | Reported | Fix PR (by others) | Status 29–30 Oct |
|---|---|---|---|
| picomatch — unmatched `)` drives `state.parens` to -1 | [issue #243](https://github.com/micromatch/picomatch/issues/243) | [PR #245](https://github.com/micromatch/picomatch/pull/245) (Ekko82) — applies the guard proposed in the report **verbatim** and credits the reporter | **open, unmerged** |
| picomatch — `noext: true` clears `isGlob` | [issue #242](https://github.com/micromatch/picomatch/issues/242) | [PR #244](https://github.com/micromatch/picomatch/pull/244) (junaidkhan80121) — `Closes #242` | **open, unmerged** |
| jsesc — invalid radix literals for negative numbers | [issue #79](https://github.com/mathiasbynens/jsesc/issues/79) | [PR #80](https://github.com/mathiasbynens/jsesc/pull/80) (fly1d) — covers fractional/non-finite; the negative integer remains for #73/#76 | **open, unmerged** |

**What this shows:** the findings are real defects that other developers considered worth fixing, and the reports (including
one-line guards) were concrete enough for someone to pick up. **What it does not show:** project approval — the PRs are open.

## 3. Notes that go with the status

- **Contamination is possible:** the analysed commits and upstream issues are public and predate the analysis. For jsesc, the topic
  (negative radix) had PRs (#73, #76) even before our report. That is why "new discovery" is never claimed.
- **Two duplicates are reported honestly** (mustache #854, bcryptjs #170) and were not hidden; the tables label them as
  "already reported before the analysis".
- **No maintainer responses** — neither approval nor rejection — on 30 Oct 2026. The correct status is therefore "filed / picked up",
  not "accepted".
- **Independent verification (F5) checked this** and corrected the original claim: 2 of the 12 F4 findings are duplicates and
  mustache F-001 was initially misjudged (corrected). Details: `../reports/final/F5-VERIFICATION.md` §4 and
  `../reports/final/F4-real-world.md` §4b.

## 4. Sources

- `../reports/final/F4-real-world.md` §4b/§4c (table of all 12 + hand-check correction)
- `../reports/final/README.md` §4d
- `../HISTORY.md`, section "Upstream impact (qualitative)" (v0.2.2 PRs)
- `../reports/final/README.md` §6 (limitations: "no report has a maintainer response yet")
