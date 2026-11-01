# CodeProof in Docker

The container image runs the whole project: the offline gates (mock demo, deterministic tests, golden
replay, golden score, integrity gate), live model runs, and the MCP server. The project has zero runtime
dependencies, so the image is a plain Node 26 runtime with `git`/`make`, the repository and its
committed evidence baked in — no `npm install`, no build step.

- [Quick start](#quick-start)
- [What runs where](#what-runs-where)
- [Measured results of this image](#measured-results-of-this-image)
- [Live model runs](#live-model-runs)
- [Analyzing a repository](#analyzing-a-repository)
- [MCP server](#mcp-server)
- [Docker Compose](#docker-compose)
- [What is inside the image](#what-is-inside-the-image)
- [Verify the image yourself](#verify-the-image-yourself)
- [Limits and honest deltas](#limits-and-honest-deltas)
- [Troubleshooting](#troubleshooting)

## Quick start

```bash
docker build -t codeproof .

docker run --rm codeproof          # mock pipeline (make demo)
docker run --rm codeproof test     # 268 deterministic tests
docker run --rm codeproof replay   # offline replay of the committed golden run (9/9)
docker run --rm codeproof score    # golden score against the frozen expectations
docker run --rm codeproof integrity
```

Every command above is offline: no API key, no model call, no network. `make docker-check` builds the
image and runs the whole set plus an MCP handshake in one step:

```bash
make docker-check
```

`docker run --rm codeproof` with no command runs the demo (the image's default command). `codeproof` is
the local tag used throughout this document; any tag works.

## What runs where

| Command | Inside the container | Network | API key |
|---|---|---|---|
| `docker run --rm IMAGE` or `... demo` | `make demo` — mock pipeline over `fixtures/mini-repo`, including real local L3/L4 executions | no | no |
| `... test` | `make test` — 268 deterministic tests | no | no |
| `... replay` | `make replay` — replays the committed golden run (L0/L1) | no | no |
| `... replay-v2 [dir]` | `make replay-v2 RUN=<dir>` — replays a v2 report (attestation, L1–L4) | no | no |
| `... score [dir]` | `make score RUN=<dir>` — scores against the frozen expectations | no | no |
| `... integrity` | `make integrity` — frozen-evidence and test-lock gate | no | no |
| `... analyze /target --mock` | `node src/cli.mjs analyze` — mock adapter only | no | no |
| `... analyze /target --mode smoke` | live run: scanner + verifier + optional L3/L4 | yes | yes |
| `... mcp` | MCP server (JSON-RPC over stdin/stdout) | no for its tools | no |
| `... cli <args>` | any raw `src/cli.mjs` command, e.g. `cli replay <dir> [repo]` | — | — |
| `... help` | usage text | no | no |
| `... shell` | `sh` inside the image | — | — |
| `... make <target>` | anything else is executed as-is: `make bench`, `node --version`, `sh -c '...'` | — | — |

Environment knobs are the same as on the host: `MODEL_API_KEY`, `META_BASE_URL`, `BUDGET_USD`,
`SCANNER_MODEL`, `VERIFIER_MODEL`, `MAX_FINDINGS`, `CHUNKED_SCAN`, `DUAL_SCAN`, `REPRO`, `PATCH`, …
(see [`src/config.mjs`](src/config.mjs)). `USE_MOCK=1` together with `analyze --mock` runs the local
L3/L4 executions too, exactly like `make demo`; without it a `--mock` analyze stops at L0–L2.

## Measured results of this image

Measured on this host (Docker 29.9.2, `node:26.8.2-alpine`), from a clean build of this tree:

| Item | Result |
|---|---|
| Build | 13.0 MB build context; no-cache rebuild 4 s with the base image local; image **305 MB** (304,743,086 bytes; the Node base image alone is 250 MB and the project layer with `.git` is 27 MB) |
| Runtime | Node `v26.8.2`, `node` user `uid=1000`, no root |
| `docker run --rm codeproof` (demo) | exit 0, 2 verified + 1 moderate + 1 L1 reject, 1 reproduced; evidence levels `citation+adversarial` and **`patch-proven`** (so the L3 LinkCheck `--allow-inspector` path works in the image) |
| `... test` | **268/268 pass**, 0 fail (Alpine/musl) |
| `... replay` | **9/9 identical, 0 mismatch**, `sha256 3d78836e416fdea136d1b648f570815edec2d5d5849b9bc81eb34084eb4341da` — byte-identical to the host result |
| `... score` | `"pass": true` (e2e recall 8/8, precision 100%, traps 0/4, no false refutations) |
| `... integrity` | **INTEGRITY PASS: 22 checks** (baseline `2040aa9`) — the baked `.git` carries the revisions the locks and frozen trees need |
| Read-only mounted git repository | `analyze /target --mock` with `USE_MOCK=1` produced `patch-proven`; the host repository stayed byte-clean (`git status` empty) |
| `docker run -i --rm codeproof mcp` | `initialize`, `tools/list` and a `codeproof_scan` call on `/app/fixtures/mini-repo` all answered |
| Node 22 variant (`--build-arg NODE_IMAGE=node:22-alpine`) | built (293 MB); `test` 268/268; demo runs but stays at `citation+adversarial` (documented L2-only behaviour, no `--allow-inspector` on Node 22) |
| Compose | `docker compose build`, `docker compose run --rm codeproof test` (268/268) and the demo pass; a local `.env` is passed to the container at runtime |
| `.env` / secrets baked | no: `.env`, `.env.*` and `*.log` are excluded by [`.dockerignore`](.dockerignore) and absent from the image |

## Live model runs

The key is taken at runtime and is never baked into the image. Pass it with `-e` or `--env-file`:

```bash
mkdir -p reports/docker-out
docker run --rm \
  -e MODEL_API_KEY=... \
  -v "$PWD/path/to/repo:/target:ro" \
  -v "$PWD/reports/docker-out:/reports" \
  codeproof analyze /target --mode smoke --out /reports/run
```

- The analyzed repository is mounted **read-only**. Analysis reads tracked files from the `git` commit and
  writes nothing inside the target; the CLI also refuses an `--out` path inside the analyzed repository
  unless `--allow-output-in-target` is passed.
- Create the output directory on the host first (`mkdir -p reports/docker-out`, ignored by `.gitignore`).
  The container runs as uid 1000; if your host user has another uid, add
  `--user "$(id -u):$(id -g)"` (then only the mounted output directory must be writable).
- Without a volume the run artifacts stay inside the container and disappear with `--rm`. Fetch them with
  `docker cp` or mount `/reports` as above.
- Budget and cost behave exactly as on the host: `BUDGET_USD` is enforced before each call, and
  `run.json` records the same ledger. A live run costs the same model money whether it runs here or on the
  host.
- L3/L4 need Node 26 (the image's default); a live run on the Node 22 variant stays at L2 `verified`.
- `.env` inside `/app` is not baked, so the CLI cannot pick a key from it; pass the variables explicitly
  (Compose does it for you, see below).

## Analyzing a repository

```bash
# offline, mock adapter only (L0-L2)
docker run --rm -v "$PWD/some/repo:/target:ro" codeproof analyze /target --mock

# offline, with the real local L3/L4 executions (same as make demo)
docker run --rm -e USE_MOCK=1 -v "$PWD/some/repo:/target:ro" codeproof analyze /target --mock

# live
docker run --rm -e MODEL_API_KEY=... -v "$PWD/some/repo:/target:ro" \
  -v "$PWD/reports/docker-out:/reports" codeproof analyze /target --mode smoke --out /reports/run
```

A target does not have to be a git repository. If it is one, the analyzed commit is recorded in
`run.json` and L1 checks citations against that commit, so a later `cli replay` can re-verify it.

## MCP server

The server speaks JSON-RPC 2.0 over stdin/stdout; open stdin with `-i` (Compose: `-T`):

```bash
docker run -i --rm codeproof mcp
```

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

The two tools are `codeproof_scan` (offline mock scan of a path) and `codeproof_replay` (offline replay of a
report directory). An MCP client can launch the container directly:

```json
{
  "mcpServers": {
    "codeproof": { "command": "docker", "args": ["run", "-i", "--rm", "codeproof", "mcp"] }
  }
}
```

Paths passed to the tools are container paths: mount the repository you want scanned (for example
`-v "$PWD/target:/target:ro"`) and pass `/target`. Reports produced by `codeproof_scan` live in the
container's temp directory; run the container with a report volume if you want to keep them.

## Docker Compose

[`docker-compose.yml`](docker-compose.yml) builds the same image with the default Node 26 tag and passes a
local `.env` (gitignored) to the container at runtime only:

```bash
docker compose build
docker compose run --rm codeproof            # demo
docker compose run --rm codeproof test       # tests
docker compose run --rm codeproof analyze /target --mock
docker compose run --rm -T codeproof mcp     # -T keeps stdio clean for MCP clients
```

Override the build arg for the Node 22 variant and the tags as needed:

```bash
NODE_IMAGE=node:22-alpine CODEPROOF_TAG=node22 docker compose build
```

Compose does not add mounts; add them per run (`docker compose run --rm -v ... codeproof ...`) or use plain
`docker run` as above. The repository's own reports/evidence are already inside the image; do not mount the
host `reports/` directory over `/app/reports`, that would hide the committed evidence.

## What is inside the image

- **The committed project, including `.git`.** The integrity gate, the test locks and the golden replay
  prove evidence against real git revisions, so the history is part of the image (16 MB). Without it
  `make integrity` cannot pass and `make replay` cannot fetch the analyzed commit. The image is therefore
  a snapshot of the build-time working tree: build from a clean, committed tree to keep the gates green.
- **Only committed content.** [`.dockerignore`](.dockerignore) mirrors [`.gitignore`](.gitignore): local run
  output, probe checkouts (`**/_repo`), `node_modules`, `dist`, logs and `.env` never enter the image.
  The result is 1,414 tracked files plus the Docker files themselves.
- **No dependencies to install.** The project has zero runtime dependencies; `git` (ingestion, evidence)
  and `make` (documented entry points) are the only packages added on top of Node.
- **Node 26.8.2 pinned.** It is the runtime the final round was measured on and the only one that can award
  `execution-proven`/`patch-proven` (L3 LinkCheck uses `--allow-inspector`). The Node 22 variant is a
  documented, measured fallback to L2. `NODE_IMAGE` must be an Alpine-based image (`*-alpine`) because the
  package step uses `apk`.
- **Unprivileged user.** The container runs as `node` (uid 1000); `/app` and the convenience mount point
  `/reports` are owned by it. A system-wide `safe.directory '*'` rule lets it read mounted repositories
  owned by other uids — analysis never writes inside them.
- **OCI labels** for title, description, version, license and source repository.

## Verify the image yourself

```bash
make docker-check     # build + test + demo + replay + score + integrity + MCP handshake
```

Expected highlights (from the measured run above): `ℹ pass 268 / ℹ fail 0`, `9/9 identical, 0 mismatch`,
`"pass": true` from the scorer and `INTEGRITY PASS: 22 checks`. The same checks can be run one by one with
the commands from [Quick start](#quick-start).

Also useful:

```bash
docker run --rm codeproof id                          # uid=1000(node), not root
docker run --rm codeproof sh -c 'test ! -e /app/.env' # no secrets baked
docker run --rm codeproof help                        # command summary
make docker-demo                                      # build + demo in one step
```

## Limits and honest deltas

- **Docker is not required** for the offline gates; the host `make` targets stay the primary path. The image
  is a convenience wrapper and a portable runtime, not a new proof.
- **Container isolation is not the L3 sandbox.** L3 still runs the generated test under the Node permission
  model (no network, no writes) inside the container. Docker adds another boundary, but it is not a VM, and
  the README's sandbox caveat is unchanged.
- **`make integrity` and `make replay` depend on baked `.git`.** An image built from an uncommitted or
  non-git tree cannot prove those gates; the Dockerfile copies the tree as-is.
- **Artifacts are ephemeral** unless an output volume is mounted. `--rm` deletes the container with its
  reports.
- **The image is large** because it contains the full evidence set (305 MB, of which 250 MB is the Node base
  image and 27 MB is the project). It is a developer/reproducer image, not a minimal deployment artifact.
- **Live model cost is unchanged** by the container; the budget gate, ledger and model calls behave exactly
  as described in the README.
- **`scripts/clean-clone-docker.sh` is a different check**: it re-runs the clean-clone proof inside
  `node:22-alpine` and is not replaced by this image. The image here is the runnable project at Node 26.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `permission denied while trying to connect to the Docker daemon` | your user is not in the `docker` group: add it and re-login, or run with an allowed setup |
| Output volume stays empty or permission denied | create the host directory first and match your uid: `--user "$(id -u):$(id -g)"`; the default user is uid 1000 |
| `fatal: detected dubious ownership` when analyzing a mount | should not happen (system `safe.directory '*'` is set); if you replaced the base image, re-add it |
| Build fails on `apk` | `NODE_IMAGE` must be an Alpine-based Node image |
| `make integrity` fails inside the image | the image was built from a tree whose frozen paths/tests differ from the baseline; rebuild from a clean commit |
| `analyze` exits with `MODEL_API_KEY is not set` | that was a live command without a key; use `--mock` for the offline path or pass the key |
| MCP client hangs | the container needs open stdin: `docker run -i ...`; with Compose add `-T` |
