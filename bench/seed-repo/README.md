# ledger-seed

Synthetic benchmark repository for CodeProof. **Not a product.**

- 15 TypeScript files, small enough to read in one sitting.
- Contains 8 injected correctness defects, 4 traps (patterns that look wrong but are correct), and 2 pre-registered real defects that are not among the 8.
- The bug list and line numbers live in [../expected.json](../expected.json); design notes are in [../README.md](../README.md); adjudication rules are in [../adjudication.md](../adjudication.md).

The repository is frozen after the first benchmark run. It exists so that the deterministic citation gate and the adversarial verifier can be tested without depending on an external project.
