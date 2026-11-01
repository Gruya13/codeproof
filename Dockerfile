# CodeProof container image.
#
# The project has no runtime dependencies, so this image is a plain Node runtime with git/make and
# the repository baked in. Everything the README promises offline runs with no network and no API
# key: the mock demo, the deterministic tests, the golden replay, the golden score and the
# integrity gate. A live model run takes MODEL_API_KEY at runtime; the MCP server runs on stdio.
#
# Node 26 is required for the strongest evidence labels: the L3 LinkCheck harness runs under the
# Node permission model with --allow-inspector, which Node 22 does not have (README: "A live run
# needs MODEL_API_KEY and Node 26.8.2 for L3/L4"). The default is pinned to the runtime the final
# round was measured on; build the documented L2-only variant with:
#   docker build --build-arg NODE_IMAGE=node:22-alpine -t codeproof:node22 .
# NODE_IMAGE must be an Alpine-based Node image (*-alpine): the package step uses apk.
ARG NODE_IMAGE=node:26.8.2-alpine
FROM ${NODE_IMAGE}

# git: ingestion reads tracked files and commits; replay and the integrity gate verify revisions.
# make: the documented entry points. tar (busybox, already in the Alpine base) extracts the
# `git archive` tarballs that L3 executes its snapshots from.
RUN apk add --no-cache git make

WORKDIR /app

# The project is baked in and owned by the unprivileged node user: the CLI writes run output under
# reports/ and git refreshes its index. .git is included so the integrity gate and the golden replay
# can prove evidence against real revisions; .dockerignore keeps local working data out.
COPY --chown=node:node . .

# An analyzed repository is mounted read-only and may be owned by a different host uid; a
# system-wide safe.directory rule lets the node user read it. Analysis never writes inside the
# analyzed repository (the CLI refuses an --out inside the target unless explicitly allowed).
# /reports is a convenience writable mount point for run output.
RUN git config --system --add safe.directory '*' && \
    mkdir -p /reports && \
    chown node:node /reports

USER node

LABEL org.opencontainers.image.title="CodeProof" \
      org.opencontainers.image.description="Every finding carries the level of proof it earned: machine-checked citation, adversarial confirmation, or a failing test." \
      org.opencontainers.image.version="0.2.3" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/Gruya13/codeproof"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["demo"]
