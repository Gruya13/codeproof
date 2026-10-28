# v0.2.0 evidence (two-phase L3, L4 patches, replay)

Every artifact below was produced by the v0.2.0 code and is committed verbatim. The L3/L4 proofs are awarded only on Node 26.8.2 (LinkCheck requires `--allow-inspector`); on Node 22.23.3 the same run reports `link-unproven` and the finding stays `verified`.

| Artifact | What it shows | Command |
|---|---|---|
| [baseline.json](baseline.json) | measured baseline after F0: 163/163 tests on Node 22.23.3 and 26.8.2, replay v1 9/9 | `make test`, `make replay` |
| [f1-mini-repo/](f1-mini-repo/) | real run `8e86b27679418946`: 1 proposed -> 1 verified -> **execution-proven** (control PASS 3/3, trigger FAIL 3/3, LinkCheck proven), $0.0601 | `BUDGET_USD=0.3 node src/cli.mjs analyze fixtures/mini-repo --mode smoke --out reports/v0.2.0/f1-mini-repo` |
| [f2-mini-repo/](f2-mini-repo/) | real run `72becdf8e629b60f`: execution-proven -> **patch-proven** (differential: control PASS 3/3 and trigger PASS 3/3 after the patch), $0.0845 | same command with the v0.2.0 build (L4 enabled by default) |
| [F1-SEMANTIC-REVIEW.md](F1-SEMANTIC-REVIEW.md) | the process gate F1.11: the generated control/trigger pair was reviewed and judged faithful to the claim | manual review, recorded |
| [bench/617e4b4386c6a15a/](bench/617e4b4386c6a15a/) | v0.2.0 benchmark run on the calibration fixture: **8/8 verified (100%), 0/4 traps, 7 patch-proven, 0 false positives**, $0.9186 - proves `item.status` and `bench/score.mjs` still work with the new evidence levels | `BUDGET_USD=2.5 MAX_FINDINGS=12 node src/cli.mjs analyze bench/seed-repo --mode bench --out reports/v0.2.0/bench && node bench/score.mjs --run <dir>` |
| [self-analysis/a5e5c1c9868a5e4f/](self-analysis/a5e5c1c9868a5e4f/) | **dogfooding** single pass on the project's own `src/` (21 files / 4,221 LOC `@ 25c2a26`): 3 proposed -> 3 verified, **1 execution-proven + 1 patch-proven**, 0 false positives, $0.8968. The patch-proven finding was a real defect in `unifiedDiff` (the L4 diff read index -1 on prefix-only appends) | `BUDGET_USD=3 node src/cli.mjs analyze src --mode smoke --out reports/v0.2.0/self-analysis` |
| [self-analysis/dual/](self-analysis/dual/) | dual-scan on the same target: 2 proposed -> 1 verified ($1.4074); the secondary Wonder scan failed after the truncation retry (`scanners[].status = error`) and the run degraded to the primary scanner | `BUDGET_USD=4 DUAL_SCAN=1 node src/cli.mjs analyze src --mode smoke --out reports/v0.2.0/self-analysis/dual` |
| [self-analysis/chunked/](self-analysis/chunked/) | chunked scan on the same target (10 chunks): 11 proposed -> **9 verified, 3 execution-proven, 2 patch-proven**, 2 L1 rejects, $2.2573 - the run that found `unifiedDiff` and the `scanner-secondary` fallback defect together with patches | `BUDGET_USD=4 CHUNKED_SCAN=1 node src/cli.mjs analyze src --mode smoke --out reports/v0.2.0/self-analysis/chunked` |
| fixes | the 7 defects found by the runs above were fixed in commit `52e6606` and covered by `tests/self-analysis-fixes.test.mjs` (8 tests, two-commit lock); the suite is 197/197. Three verified defects remain unfixed (README `Limits`) | `make test`, `make integrity` |

### Real-world runs (v0.2.1, L4 enabled, zero-dependency CommonJS targets)

| Artifact | What it shows | Command |
|---|---|---|
| [real-world/commander/2be86e38745c0256/](real-world/commander/2be86e38745c0256/) | [tj/commander](https://github.com/tj/commander.js) `v14.0.0` (`lib/`, 6 files / 4,193 LOC): 1 proposed -> 1 verified, no execution proof. The verified finding (five process signal forwarders registered per `_executeSubCommand` call, never removed, `lib/command.js:1291-1301`) needs `process` signals in its test, which the L3 static gate forbids - fail-closed, not a missing defect. $0.6957 | `BUDGET_USD=4 node src/cli.mjs analyze <commander>/lib --mode smoke --out reports/v0.2.0/real-world/commander` |
| [real-world/picomatch/62cbababd7a84e9a/](real-world/picomatch/62cbababd7a84e9a/) | [micromatch/picomatch](https://github.com/micromatch/picomatch) `4.0.7` (`lib/`, 5 files / 2,445 LOC), run 1: 1 proposed -> 1 verified -> execution-proven; its L4 patch returned an empty model output. $0.5252 | `BUDGET_USD=4 node src/cli.mjs analyze <picomatch>/lib --mode smoke --out reports/v0.2.0/real-world/picomatch` |
| [real-world/picomatch/62cbababd7a84e9a-2/](real-world/picomatch/62cbababd7a84e9a-2/) | same command, run 2: 3 proposed -> 3 verified, **all three execution-proven, 2 patch-proven**: unmatched `)` decrements `state.parens` below zero (`parse.js`); `noext:true` clears `isGlob` for every pattern (`scan.js`); last-token update skipped when `prevIndex === 0` (`scan.js`, patch rejected with an empty model output). $0.9407 | same command |
| [real-world/marked/6cd8009a29058221/](real-world/marked/6cd8009a29058221/) | [markedjs/marked](https://github.com/markedjs/marked) `v15.0.12` (`src/`, 13 ESM TypeScript files / 3,344 LOC): 6 proposed -> 5 verified + 1 moderate, **no execution proof** (every reproducer rejected at L0); $2.1797 | `BUDGET_USD=4 node src/cli.mjs analyze <marked>/src --mode smoke --out reports/v0.2.0/real-world/marked` |
| [real-world/semver-ranges/d9e8ddb8b4966031/](real-world/semver-ranges/d9e8ddb8b4966031/) | [npm/node-semver](https://github.com/npm/node-semver) `v7.8.5` (`ranges/`, 11 files / 540 LOC): **0 candidates** ($0.0314) - an empty result, reported as such | `BUDGET_USD=4 node src/cli.mjs analyze <semver>/ranges --mode smoke --out reports/v0.2.0/real-world/semver-ranges` |
| [real-world/json5/084c1d49becd3975/](real-world/json5/084c1d49becd3975/) | [json5/json5](https://github.com/json5/json5) `v2.2.3` (`lib/`, 13 files / 1,708 LOC): **0 candidates** ($0.0722) | `BUDGET_USD=4 node src/cli.mjs analyze <json5>/lib --mode smoke --out reports/v0.2.0/real-world/json5` |
| replay | `replay` output for the picomatch run 2: anchor verified, 19 artifacts, 0 problems, L1/L3/L4 all match | `node src/cli.mjs replay reports/v0.2.0/real-world/picomatch/62cbababd7a84e9a-2 --anchor c9cf16a --out /tmp/replay-picomatch   # c9cf16a = the evidence commit (verified)` |

### CJS-focused series and variance runs (v0.2.2)

Zero-dependency CommonJS targets were re-run 2-3 times to measure variance; the two single-run targets (commander, marked) were re-run with the v0.2.2 rules.

| Artifact | What it shows |
|---|---|
| [real-world/jsesc/b0941ba03c256e66/](real-world/jsesc/b0941ba03c256e66/) and [-2](real-world/jsesc/b0941ba03c256e66-2/) | [mathiasbynens/jsesc](https://github.com/mathiasbynens/jsesc) `v3.1.0` (337 LOC, CJS): 2/2 verified, **both execution-proven**, run 2 **patch-proven** (negative and non-integer numbers in hex/bin/oct produce invalid literals); $0.6331 |
| [real-world/he/0b59fb64d98f1e4e/](real-world/he/0b59fb64d98f1e4e/) and [-2](real-world/he/0b59fb64d98f1e4e-2/) | [mathiasbynens/he](https://github.com/mathiasbynens/he) `v1.2.0` (345 LOC): 0 candidates in both runs, $0.2540 |
| [real-world/flatted/cfdf683490416cc3/](real-world/flatted/cfdf683490416cc3/) and [-2](real-world/flatted/cfdf683490416cc3-2/) | [WebReflection/flatted](https://github.com/WebReflection/flatted) `v3.4.1` (132 LOC): 0 candidates in both runs, $0.0906 |
| [real-world/json5/084c1d49becd3975-2/](real-world/json5/084c1d49becd3975-2/) | second json5 run: 0 candidates; two runs cost $0.1533 |
| [real-world/picomatch/62cbababd7a84e9a-3/](real-world/picomatch/62cbababd7a84e9a-3/) | third picomatch run: 3 proposed -> 2 verified + 1 uncertain, 1 execution-proven + 1 patch-proven; $1.0269 |
| [real-world/commander/2be86e38745c0256-2/](real-world/commander/2be86e38745c0256-2/) and [-3](real-world/commander/2be86e38745c0256-3/) | commander variance runs: 1 verified / 0 verified (L1 reject), $0.8341 combined; both re-runs still fail closed on process signals |
| [real-world/marked/6cd8009a29058221-2/](real-world/marked/6cd8009a29058221-2/) and [-3](real-world/marked/6cd8009a29058221-3/) | marked variance runs (v0.2.2 rules): 1 verified each; the third run found `_Lexer` instance tokens are appended on reuse; $0.7211 combined |
| [real-world/picomatch/62cbababd7a84e9a-4/](real-world/picomatch/62cbababd7a84e9a-4/) and [-5](real-world/picomatch/62cbababd7a84e9a-5/) | P1/P2 verification on v0.2.2: run 4 = 5 proposed -> 3 verified + 1 moderate, **2 patch-proven** (leading-slash token and `noext`), 4 patcher calls for 2 proofs (the retry is visible), $1.5348; run 5 = 4 proposed -> 2 verified + 2 uncertain, 1 patch-proven, $1.0231 |
| [real-world/jsesc/b0941ba03c256e66-3/](real-world/jsesc/b0941ba03c256e66-3/) | P1 verification on v0.2.2: the negative-number literal patch that came back empty in run 1 is now **patch-proven**; $0.2101 |
| fixes | v0.2.2 commit `207781c`: patcher retry on empty/truncated output (P1) and a stricter reproducer prompt (P2); `tests/real-world-fixes.test.mjs` (5 tests, locked), suite 202/202. P1 recovered three previously lost patch proofs in the verification runs; P2 did not remove the L0 rejections |

## How to re-verify offline (no API key)

```bash
make integrity
make test
make replay REPLAY_OUT=/tmp/cp-replay.json          # historical v1 gate, must stay 9/9
node src/cli.mjs replay reports/v0.2.0/f2-mini-repo/72becdf8e629b60f --anchor HEAD --out /tmp/replay-v2
node src/cli.mjs replay reports/v0.2.0/bench/617e4b4386c6a15a --anchor HEAD --out /tmp/replay-bench
node src/cli.mjs replay reports/v0.2.0/self-analysis/a5e5c1c9868a5e4f --anchor 1e5f577 --out /tmp/replay-self   # dogfooding run; anchor = its evidence commit
```

`replay` checks the attestation of every artifact, recomputes the config payload hash, verifies the git anchor, re-runs L1 citations, re-executes the L3 control/trigger pair and re-applies the L4 patch (on a copy of the snapshot). It does not re-execute the semantic L2 verdict - that bound is stated in README Limits.

## Limits of these artifacts

- `execution-proven` means: control passed 3/3, trigger failed 3/3 on the analyzed commit, the imported symbol executed under inspector coverage (LinkCheck), and the semantic review judged the trigger faithful. It is not a proof that the defect is the root cause.
- `patch-proven` is a differential result over the reproduction (control still passes, trigger now passes after a minimal patch applied to a snapshot copy). The repository's own test suite is not run and the patch is never written to the analyzed repository.
- Node 22.23.3 cannot award L3/L4 proof (no `--allow-inspector`); this is documented, fail-closed behaviour, not a failure.
- The demo fixture is synthetic and checked in on purpose; the real-repository evidence lives in `reports/golden/`, `reports/real-world/` and `reports/probes/` and is unchanged by v0.2.0 (enforced by `make integrity`).
- The self-analysis runs are dogfooding, not a benchmark: one target, n = 1 per architecture, and the analysed code is the project itself. Three verified defects found there remain unfixed (README Limits).
