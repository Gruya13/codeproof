# Block C — real-world round (3 unseen repositories)

**Protocol:** pre-registered in [EXPERIMENT-PLAN.md](EXPERIMENT-PLAN.md) §C. One run per repository, `--mode smoke`,
`MAX_FINDINGS=12`, pinned commit, every run through `scripts/exp-run.sh` (attempts 18–20).
The repositories were never analyzed by this project before, have no runtime dependencies, and were cloned
locally under `reports/probes/real/candidates/` (git-ignored).

| Repository | Pin | Scope | Files / LOC | Published | Cost | Duration |
|---|---|---|---:|---:|---:|---:|
| [Rich-Harris/devalue](https://github.com/Rich-Harris/devalue) | `b0b7a4cc` | `src/` | 12 / 2655 | **0** | $0.1913 | 126 s |
| [json5/json5](https://github.com/json5/json5) | `6d21f2f8` | `lib/` | 7 / 1808 | **0** | $0.0661 | 35 s |
| [jridgewell/sourcemap-codec](https://github.com/jridgewell/sourcemap-codec) | `363fb9be` | `src/` | 4 / 576 | **2 verified** | $0.4292 | 162 s |

**Total: 3 repositories, 2 published findings, $0.6866.** Two of three repositories produced no published
finding; that is reported as measured, not hidden.

## Hand-check

Both findings are in `src/scopes.ts` of `@jridgewell/sourcemap-codec` and both are encoder/decoder asymmetries.
Neither is covered by the upstream tests (`test/scopes.test.ts`), and both were reproduced mechanically with the
package's own functions (copies under [checks/smc-roundtrip/](checks/smc-roundtrip/), run with
`node --experimental-strip-types`).

| # | Finding | Claim | Hand-check | Evidence |
|---|---|---|---|---|
| **F-001** | `encodeOriginalScopes` resets the line state for every top-level scope | The encoder starts each top-level scope with a fresh `[0]` state; the decoder keeps one running `line` across the whole input, so the second and later top-level scopes round-trip with a wrong line offset. | **CONFIRMED** | one top-level: round-trip true; two top-level: `[[0,0,5,10,1],[6,0,10,10,1]]` encodes to `AACA,KU,MACA,IU` and decodes to `[[0,0,5,10,1],[11,0,15,10,1]]` — round-trip false ([rt.mjs](checks/smc-roundtrip/rt.mjs)) |
| **F-003** | binding column base is not reset when the line changes during encoding | For a binding whose expression ranges move to a different line, the encoder keeps the previous column as the base while the decoder resets the base to 0 — the decoded column is wrong. | **CONFIRMED** | binding `[[0],[0,2,5],[0,4,9]]` encodes to `AAHAEKAEIA;;;;U` and decodes to `[[0],[0,2,5],[0,4,4]]` (column 4 instead of 9) ([rt-generated.mjs](checks/smc-roundtrip/rt-generated.mjs)) |

Both findings stayed at **L2 (`verified`)**: the L3 reproducer could not run because the package's internal
imports have no file extensions (`ERR_MODULE_NOT_FOUND: .../snapshot/strings`), which is the documented
limitation for TypeScript trees that need their own build step. This is the first real-world evidence point for
that limitation.

## What was checked and what was not

- The claims were checked against the pinned code and against the package's own encoder/decoder, not against the
  upstream issue tracker. **Novelty is not claimed**; no upstream issue was filed.
- The two zero-finding repositories are not evidence that they are clean — the scanner is capped and one pass is
  one pass.
- The round-trip failures show that the encoder and decoder disagree for inputs the upstream tests do not cover.
  Whether those inputs occur in practice (e.g. whether sourcemap "scopes" sections ever contain more than one
  top-level scope) is not established.

## Cost

Block C: **$0.6866** across 3 attempts (planned ~$4). The plan allowed a second run when a repository published
nothing; that option was **not used** — the zero-finding results are reported as they are instead of retried
until something appears.
