# execa probe runs - hand check

- Repository: [sindresorhus/execa](https://github.com/sindresorhus/execa) at commit `247faa0ff0641020e8790475989cee72df85d62b` (2026-10-23, `execa@10.2.1`)
- Scope: `lib/` - 110 files, 8,227 LOC; all 110/110 files fit the scanner prompt (350,469 chars, ~97k tokens)
- Runs: 2 runs on the same commit, mode `smoke`, scanner `muse-spark-1.3`, verifier `muse-wonder-1.0`, `MAX_FINDINGS=8`
- Measured: run 1 **0 findings** ($0.3486, 83 s, 2 calls); run 2 **1 proposed / 1 verified** ($0.2945, 136 s, 3 calls). Total **$0.6432**.
- The analyzed code was never executed; the analysis is static.

## Finding F-001 (verified in run 2)

**Claim:** shebang parsing uses `split(' ', 2)`, so interpreter arguments beyond the first token are dropped, and for non-`env` interpreters the interpreter plus argument are returned as one space-containing file path that cannot resolve correctly.

**Code:** `lib/arguments/command-file.js:151-162`

```js
const shebangLine = contents.match(shebangRegExp)?.groups.line.trim();
...
const [interpreterPath, argument] = shebangLine.split(' ', 2);
const interpreter = interpreterPath.split('/').at(-1);
if (interpreter === 'env') {
	return argument;
}
return argument ? `${interpreter} ${argument}` : interpreter;
```

The returned value becomes `parsed.file` in `resolveWithShebang()` (same file, lines 62-76) and is then resolved with `whichCommandSync` as a single file name.

**Hand verdict: confirmed defect, Windows-only, undocumented, not reported upstream (as of 26.10.2026).**

- On Unix the parser is not used (`parseCommandFile` returns early when `process.platform !== 'win32'` or a shell is used), so this only affects Windows shebang emulation.
- Examples of the parsed value ("interpreter"): `#!/usr/bin/env node` → `node` (correct); `#!/usr/bin/node --experimental` → `node --experimental` (a file name with a space - will not resolve); `#!/usr/bin/env -S node --loader ts-node/esm` → `-S node --loader ts-node/esm` (wrong: `-S` is an env flag, not an interpreter).
- The Windows documentation ("Execa adds support for shebangs", `docs/windows.md`) does not state this limitation, and no matching open upstream issue was found (searches: repo issues/PRs for "shebang", "command-file", "split interpreter").
- Hand severity: **medium-low** (Windows-only; scripts whose shebang carries interpreter arguments; workaround: invoke the interpreter explicitly, e.g. `execa('node', ['script.js'])`). The scanner rated it high.
- Verification limit: the Windows code path was not executed here (Linux host); this is a static adjudication plus a copy of the exact parser logic. No modification of the analyzed repository was made.

## Runs / evidence

- `run-1/`, `run-2/`: verbatim run artifacts (`run.json`, `findings.json`, `REPORT.md`, `rejected.md`, `candidates.json`)
- `probe.json`, `scope.json`: harness outputs (scope check and prompt measurement)
- The two runs are not bit-identical: run 1 proposed nothing, run 2 found the shebang defect. No cherry-picking; both runs are published.

## Caveats

- Public commit; a model may have seen it (contamination possible). This is a qualitative anecdote, not a benchmark metric.
- One verified finding in two runs; no claim of recall or completeness.
