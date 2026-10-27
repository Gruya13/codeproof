# Model ablation — Spark alone vs Wonder alone vs CodeProof

Repo `/home/gru/Projects/Meta hakatron/codeproof/reports/probes/_repo/ufo/src` @ `f06c800`; same scanner prompt, schema and digest for every variant.

| Variant | Model | Runs | Candidates | L1-valid | Overlap with CodeProof | New vs CodeProof | Cost | Time |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| spark-only | `muse-spark-1.3` | 1 | 6 | 6 | 3 | 3 | $0.0746 | 54.5 s |
| codeproof (full gate) | spark + wonder | - | 4 | 4 verified | - | - | (existing run) | - |
