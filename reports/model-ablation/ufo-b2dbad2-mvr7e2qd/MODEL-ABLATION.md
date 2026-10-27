# Model ablation — Spark alone vs Wonder alone vs CodeProof

Repo `/home/gru/Projects/Meta hakatron/codeproof/src` @ `b2dbad2`; same scanner prompt, schema and digest for every variant.

| Variant | Model | Runs | Candidates | L1-valid | Overlap with CodeProof | New vs CodeProof | Cost | Time |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| spark-only | `muse-spark-1.3` | 1 | 4 | 4 | 4 | 0 | $0.0702 | 54.1 s |
| codeproof (full gate) | spark + wonder | - | 6 | 5 verified | - | - | (existing run) | - |
