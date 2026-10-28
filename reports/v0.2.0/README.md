# v0.2.0 evidence (two-phase L3, L4 patches, replay)

Every artifact below was produced by the v0.2.0 code and is committed verbatim. The L3/L4 proofs are awarded only on Node 26.8.2 (LinkCheck requires `--allow-inspector`); on Node 22.23.3 the same run reports `link-unproven` and the finding stays `verified`.

| Artifact | What it shows | Command |
|---|---|---|
| [baseline.json](baseline.json) | measured baseline after F0: 163/163 tests on Node 22.23.3 and 26.8.2, replay v1 9/9 | `make test`, `make replay` |
| [f1-mini-repo/](f1-mini-repo/) | real run `8e86b27679418946`: 1 proposed -> 1 verified -> **execution-proven** (control PASS 3/3, trigger FAIL 3/3, LinkCheck proven), $0.0601 | `BUDGET_USD=0.3 node src/cli.mjs analyze fixtures/mini-repo --mode smoke --out reports/v0.2.0/f1-mini-repo` |
| [f2-mini-repo/](f2-mini-repo/) | real run `72becdf8e629b60f`: execution-proven -> **patch-proven** (differential: control PASS 3/3 and trigger PASS 3/3 after the patch), $0.0845 | same command with the v0.2.0 build (L4 enabled by default) |
| [F1-SEMANTIC-REVIEW.md](F1-SEMANTIC-REVIEW.md) | the process gate F1.11: the generated control/trigger pair was reviewed and judged faithful to the claim | manual review, recorded |
| [bench/617e4b4386c6a15a/](bench/617e4b4386c6a15a/) | v0.2.0 benchmark run on the calibration fixture: **8/8 verified (100%), 0/4 traps, 7 patch-proven, 0 false positives**, $0.9186 - proves `item.status` and `bench/score.mjs` still work with the new evidence levels | `BUDGET_USD=2.5 MAX_FINDINGS=12 node src/cli.mjs analyze bench/seed-repo --mode bench --out reports/v0.2.0/bench && node bench/score.mjs --run <dir>` |

## How to re-verify offline (no API key)

```bash
make integrity
make test
make replay REPLAY_OUT=/tmp/cp-replay.json          # historical v1 gate, must stay 9/9
node src/cli.mjs replay reports/v0.2.0/f2-mini-repo/72becdf8e629b60f --anchor HEAD --out /tmp/replay-v2
node src/cli.mjs replay reports/v0.2.0/bench/617e4b4386c6a15a --anchor HEAD --out /tmp/replay-bench
```

`replay` checks the attestation of every artifact, recomputes the config payload hash, verifies the git anchor, re-runs L1 citations, re-executes the L3 control/trigger pair and re-applies the L4 patch (on a copy of the snapshot). It does not re-execute the semantic L2 verdict - that bound is stated in README Limits.

## Limits of these artifacts

- `execution-proven` means: control passed 3/3, trigger failed 3/3 on the analyzed commit, the imported symbol executed under inspector coverage (LinkCheck), and the semantic review judged the trigger faithful. It is not a proof that the defect is the root cause.
- `patch-proven` is a differential result over the reproduction (control still passes, trigger now passes after a minimal patch applied to a snapshot copy). The repository's own test suite is not run and the patch is never written to the analyzed repository.
- Node 22.23.3 cannot award L3/L4 proof (no `--allow-inspector`); this is documented, fail-closed behaviour, not a failure.
- The demo fixture is synthetic and checked in on purpose; the real-repository evidence lives in `reports/golden/`, `reports/real-world/` and `reports/probes/` and is unchanged by v0.2.0 (enforced by `make integrity`).
