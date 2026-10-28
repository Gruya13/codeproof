# Model ablation — Spark alone vs Wonder alone vs CodeProof

Repo `/home/gru/Projects/Meta hakatron/codeproof/src` @ `25c2a26`; same scanner prompt, schema and digest for every variant.

| Variant | Model | Runs | Candidates | L1-valid | Overlap with CodeProof | New vs CodeProof | Cost | Time |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| spark-only | `muse-spark-1.3` | 1 | 4 | 4 | 3 | 1 | $0.1357 | 73.5 s |
| codeproof (full gate) | spark + wonder | - | 3 | 3 verified | - | - | (existing run) | - |
