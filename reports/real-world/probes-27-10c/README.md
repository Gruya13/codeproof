# Real-world probe round III — 27.10.2026 (L3 enabled, new domains)

Third wave, deliberately different domains and much larger targets than before: a markdown parser (marked), a date library (dayjs), a web framework (express), a string utility (slugify) and a glob matcher (minimatch).

| Repo | Domain | Target | Files / LOC | Proposed | Verified | Uncertain | Reproduced | Cost |
|---|---|---|---:|---:|---:|---:|---:|---:|
| [markedjs/marked](https://github.com/markedjs/marked) `4bdd7e0c` | markdown parser | `src/` | 13 / 4,070 | 3 | 1 | 2 | **1** | $1.1185 |
| [iamkun/dayjs](https://github.com/iamkun/dayjs) `436bde0` | date library | `src/` | 184 / 9,082 | 6 | 4 | 0 | 0 | $1.7285 (aborted by the hard budget) |
| [expressjs/express](https://github.com/expressjs/express) `1c6f1b0f` | web framework | `lib/` | 6 / 2,765 | 0 | 0 | 0 | - | $0.2143 |
| [sindresorhus/slugify](https://github.com/sindresorhus/slugify) `3b17b2e` | string utility | repo root | 4 / 825 | 4 | 4 | 0 | 0 | $1.0469 |
| [isaacs/minimatch](https://github.com/isaacs/minimatch) `ded1bbd` | glob matching | `src/` | 6 / 2,721 | 2 | 1 | 1 | 0 | $0.8096 |

Total: **15 candidates, 10 published (0 false positives), 3 uncertain, 1 execution-proven, $4.918**, one run per repository.

## Execution-proven finding (marked)

`Lexer.blockTokens` unconditionally sets `this.state.top = true` on return (marked `src/Lexer.ts:309-310`), while `Tokenizer.list` sets `state.top = false` for list items. The model wrote a test that drives the real lexer through a nested list and asserts the expected token stream; it failed 3/3 on the analyzed commit. Artifacts: `marked/759fa0153f434967/repro/`.

## Hand-checked findings

| Repo | Finding | Verdict |
|---|---|---|
| slugify | F-001/F-002/F-004: `options.separator` is passed as the **replacement string** to `String.replace`/`replaceAll` (`index.js:108`, `:18-20`, `:86-88`), so a custom separator containing `$&`, `$'`, `$1` or `$$` is expanded as a replacement pattern instead of being inserted literally | **CONFIRMED** - use a replacer function `() => separator`; real defect for custom separators (low/medium) |
| dayjs | F-004: `utc` `valueOf` uses `this.$x.$localOffset || this.$d.getTimezoneOffset()`, so a stored local offset of **0** is falsy and replaced by the runtime timezone offset (`plugin/utc/index.js:119-123`) | **CONFIRMED** - classic `||`-with-zero defect (medium) |
| marked | F-002 (execution-proven, above) | confirmed by the runner |
| minimatch | F-001: empty-extglob detection checks `ast.#parts.length` before the parts are pushed (`src/ast.ts:498-505`) | published and verified; not hand-adjudicated |
| dayjs | F-001/F-002/F-003 (locale fallback, duration sign, weeks component) | published and verified; not hand-adjudicated |

## What this round exposed in the system

1. **The hard budget works and it stopped a run before overspending.** dayjs was the largest target so far (9,082 LOC, 184 files); the run reached $1.7285 of a $2 cap and the pre-flight estimate then refused the next call. The findings collected up to that point were still published.
2. **The abort message was wrong.** The CLI printed `run budget exceeded: spent 1.7285 USD of 2` although the limit was not exceeded - the hard gate had refused the *next* call. Fixed: the CLI now reports the real reason (`run aborted by the budget gate: hard budget: ...`) and records `budget.abortReason` in `run.json`.
3. **Verifier truncation is the main robustness limit on large targets.** marked produced two `uncertain` verdicts because the verifier response hit `finish_reason=length`; dayjs and slugify spent most of their time in verification. For targets above ~5k LOC the verifier token budget, not the model, decides how many findings get a verdict.
4. **Scanner variance remains large and is reported as such:** marked proposed 3, dayjs 6, slugify 4, minimatch 2, express 0 (with one truncation retry) - one run per repository, no claim about defect density.

## Caveats

- Public repositories cloned at HEAD; the model may have seen the code. Findings are not claimed as novel discoveries.
- One run per repository; scanner and verifier output is not bit-deterministic.
- dayjs was aborted by the budget gate after publishing 4 verified findings; its run.json marks `budget.aborted: true`.
- L3 was not executable for dayjs, slugify and minimatch (extensionless/internal imports or external dependencies); marked was executable because its sources import explicit `.ts` files.

Artifacts: one directory per run under `express/`, `marked/`, `dayjs/`, `slugify/`, `minimatch/`.