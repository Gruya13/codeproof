# Large-repository runs — postcss and hono (27.10.2026)

Two runs on much larger targets than the earlier probes, to test the pipeline's scale limits. Both use the normal single-scanner path with L3 enabled and a $4 hard budget.

| Repo | Target | Files / LOC | Scanner prompt coverage | Proposed | Verified | Reproduced | Cost | Duration |
|---|---|---:|---|---:|---:|---:|---:|---:|
| [postcss/postcss](https://github.com/postcss/postcss) `2455ac8` | `lib/` | 51 / 8,485 | **51 / 51 files** (263,471 chars, no truncation) | 3 | 3 | 0 | $0.5961 | 211 s |
| [honojs/hono](https://github.com/honojs/hono) `bac5c4a` | `src/` | **313 / 82,078** | **69 / 313 files** (396,993 / 400,000 chars, **truncated**) | 3 | 3 | 0 | $0.8660 | 256 s |

## Postcss — full coverage, three verified findings

At 8.5k LOC the whole target fits into the scanner prompt (51/51 files), so this run is a complete analysis. Three findings were proposed and all three were confirmed by the verifier:

- **fromJSON cannot rehydrate `Document` nodes** — it handles `root`/`decl`/`rule`/`comment`/`atrule` and throws `Unknown node type` for `document`, although `Document` is a public postcss node type (`lib/document.js`). Hand check: **confirmed** (the code path is exactly as cited).
- Long-line truncation in `css-syntax-error` computes the end column from `this.endColumn + padding` without guarding `undefined`, producing `NaN` and an empty snippet when the error has no range.
- `NoWorkResult.toString()` returns raw `_css` while the `css` getter returns the stripped/updated `result.css`, so string coercion can diverge from `.css`.

L3 could not execute any of the three: the generated tests failed with `Cannot find module 'picocolors'` — postcss's own modules `require()` an external package that is not installed in the snapshot. That is an environment limit, and the runner now classifies it as `repro-unavailable` instead of `inconclusive` (see below).

## Hono — the prompt cap is reported honestly, but the coverage is alphabetical

hono `src/` is 313 files / 82k LOC / ~2.2M characters. The scanner prompt cap is 400k characters, so **only 69 of 313 files (22%) reached the model** - the run printed a warning, recorded it in `run.json.scanCoverage` (`{ filesInPrompt: 69, filesTotal: 313, chars: 396993, cap: 400000, truncated: true }`) and put a line into `REPORT.md`. All three verified findings are in `adapter/aws-lambda/handler.ts`, which is simply what the alphabetical order puts first - the analysis is **partial and biased towards the alphabetical prefix**, not representative of the repository.

All three findings were confirmed by the verifier; two are hand-checked:

- **ALB multi-value headers are joined with `'; '`** for every header (`handler.ts:546-551`), while RFC 9110 list-based fields such as `x-forwarded-for` must be joined with `', '`. Hand check: **confirmed** by reading the code.
- **The V2 query-string builder does not encode keys/values** (`handler.ts:585-595`) while the V1 processor does (`encodeURIComponent` on line 494), so spaces, `&`, `=` and non-ASCII produce invalid URLs in V2. Hand check: **confirmed** by comparing the two processors in the same file.
- The Lattice V2 processor ignores `queryStringParameters` entirely and returns an empty query string.

L3 was `unavailable` for all three (TypeScript with extensionless internal imports), as on other TypeScript repositories.

## What this round exposed

1. **The 400k-character scanner cap is a real ceiling for large repositories.** Analysis above ~15-20k LOC is partial; the pipeline reports it honestly (console warning, `run.json.scanCoverage`, a line in the report summary), but the selection is alphabetical, so a large run can spend money analysing a directory prefix. **Recommendation:** for large repositories use the existing per-directory target (`analyze <repo>/src/router`, `analyze <repo>/packages/core`) or raise `filesWithLineNumbers`' cap deliberately and budget for it; there is no relevance-aware file selection yet.
2. **Cost at scale is dominated by the scanner input, not by the number of findings:** hono cost $0.87 to scan 22% of a large repository and produce three findings; postcss cost $0.60 to fully analyse 8.5k LOC.
3. **L3 does not run on either target** - postcss requires an uninstalled external package from its own modules, hono uses extensionless TypeScript imports. This is the expected limitation, and both cases are now classified as `repro-unavailable` (the CommonJS `Cannot find module` case was previously misclassified as `inconclusive`; fixed and covered by a test).

## Caveats

- One run per repository; scanner and verifier output is not bit-deterministic.
- The repositories are public and cloned at HEAD; findings are not claimed as novel discoveries.
- postcss run predates the `Cannot find module` classification fix; its three L3 results are recorded as `inconclusive` in the artifacts because that is what the run produced.

Artifacts: `postcss/e8eea43af88affea/`, `hono/edd5296bd3f4fe5b/` (`run.json` with `scanCoverage`, `findings.json`, `REPORT.md`, `rejected.md`).