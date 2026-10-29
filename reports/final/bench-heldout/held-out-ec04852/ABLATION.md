# Ablation on the held-out set

Repo `/home/gru/Projects/Meta hakatron/codeproof/bench/held-out` @ `ec04852`; 6 defects, 4 traps.

| Configuration | Published | True positives | False positives | Trap leaks | Recall | Precision |
|---|---:|---:|---:|---:|---:|---:|
| scanner only | 6 | 6 | 0 | 0 | 1 | 1 |
| + L1 | 6 | 6 | 0 | 0 | 1 | 1 |
| + L1 + L2 | 6 | 6 | 0 | 0 | 1 | 1 |
| + L1 + L2 + L3 | 5 | 5 | 0 | 0 | 0.833 | 1 |

Measured cost: $0.4069; duration 228.0 s.

Every published finding is listed in `ablation.json` with its L1/L2/L3 outcome.
