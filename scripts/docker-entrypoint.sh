#!/bin/sh
# Dispatcher for the CodeProof container image (see Dockerfile and DOCKER.md).
#
# `docker run --rm <image>` runs the offline mock demo. The documented subcommands below cover the
# offline gates; anything that is not a known subcommand is executed as-is, so `make test`,
# `node --version` or `sh -c '...'` still work inside the image.
set -eu

usage() {
  cat <<'EOF'
CodeProof container image - offline first: no API key and no network are needed for the gates.

usage: docker run --rm <image> <command> [args...]

commands:
  demo              mock pipeline over fixtures/mini-repo (default; no model calls, no network)
  test              deterministic test suite (make test)
  replay            offline replay of the committed golden run (v1 gates)
  replay-v2         offline replay of a v2 report: node src/cli.mjs replay <report-dir> [repo]
  score             score the golden run against the frozen expectations
  integrity         frozen-evidence and test-lock gate (make integrity)
  analyze <args...> live or mock analysis: node src/cli.mjs analyze <args...>
  cli <args...>     any other CLI command, e.g. cli replay <report-dir> [repo-path]
  mcp               MCP server over stdin/stdout (run the container with -i)
  shell             interactive shell
  help              this text

Environment:
  USE_MOCK=1 with analyze runs the local L3/L4 executions too (the demo sets it for you)
  RUN        report directory for replay-v2 (default reports/golden)
  REPLAY_OUT file for the replay artifact (default /tmp/codeproof-replay.json)
  MODEL_API_KEY, BUDGET_USD, META_BASE_URL, SCANNER_MODEL, ...  live-run configuration

Anything else is executed as a command, e.g.:
  docker run --rm <image> make bench         # needs MODEL_API_KEY
  docker run --rm <image> node --version
EOF
}

case "${1:-demo}" in
  demo) exec make demo ;;
  test) exec make test ;;
  integrity) exec make integrity ;;
  replay)
    shift || true
    if [ "$#" -gt 0 ]; then
      exec make replay RUN="$1" REPLAY_OUT="${REPLAY_OUT:-/tmp/codeproof-replay.json}"
    fi
    exec make replay REPLAY_OUT="${REPLAY_OUT:-/tmp/codeproof-replay.json}"
    ;;
  replay-v2)
    shift || true
    exec make replay-v2 RUN="${1:-${RUN:-reports/golden}}"
    ;;
  score)
    shift || true
    exec make score RUN="${1:-${RUN:-reports/golden}}"
    ;;
  analyze) shift; exec node src/cli.mjs analyze "$@" ;;
  cli) shift; exec node src/cli.mjs "$@" ;;
  mcp) shift; exec node src/mcp/index.mjs "$@" ;;
  help|-h|--help) usage; exit 0 ;;
  shell) exec sh ;;
  *) exec "$@" ;;
esac
