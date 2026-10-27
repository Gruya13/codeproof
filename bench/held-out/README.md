# Held-out evaluation set (provenance)

This fixture was written on 27.10.2026, after the scanner prompt (v3) was frozen, and was **never used** to tune prompts or thresholds. It exists to test generalization:

- 6 direct correctness defects (`expected.json` -> `problems`)
- 4 negative controls / traps (`expected.json` -> `traps`) that look suspicious but are correct

It is **not** part of the scored benchmark in `bench/seed-repo/` and its results are not a benchmark metric. Run it with `node scripts/ablation.mjs`.

Every file is small, JavaScript-only (ESM), and depends on nothing outside `src/`.
