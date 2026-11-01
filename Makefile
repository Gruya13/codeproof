.PHONY: demo test controlled bench score replay replay-v2 integrity clean-clone clean-clone-docker probe-repo ablation three-way docker-build docker-demo docker-check

# Docker image tag used by the docker-* targets (see Dockerfile and DOCKER.md).
DOCKER_IMAGE ?= codeproof:local

demo:
	USE_MOCK=1 node src/cli.mjs analyze fixtures/mini-repo --mock

test:
	node --test tests/*.test.mjs

controlled:
	node src/cli.mjs controlled-verifier fixtures/mini-repo --candidates fixtures/mini-repo/controlled-candidates.json

bench:
	MAX_FINDINGS=12 node src/cli.mjs analyze bench/seed-repo --mode bench

score:
	node bench/score.mjs --run "$(RUN)"

three-way:
	node scripts/three-way.mjs --repo bench/seed-repo --expected bench/expected.json $(if $(RUN),--codeproof-run $(RUN),) --runs 1

replay:
	node scripts/replay-gates.mjs --run "$(if $(RUN),$(RUN),reports/golden)" $(if $(REPLAY_OUT),--out "$(REPLAY_OUT)",)

replay-v2:
	node src/cli.mjs replay "$(RUN)"

integrity:
	node scripts/integrity.mjs

clean-clone:
	scripts/clean-clone.sh

clean-clone-docker:
	scripts/clean-clone-docker.sh

probe-repo:
	node scripts/probe-repo.mjs $(ARGS)

ablation:
	node scripts/ablation.mjs --repo bench/held-out

# Docker: the image bakes the project and its committed evidence, so every offline gate runs
# inside it. MODEL_API_KEY is only needed for live runs and is passed at runtime, never baked in.
docker-build:
	docker build -t $(DOCKER_IMAGE) .

docker-demo: docker-build
	docker run --rm $(DOCKER_IMAGE)

docker-check: docker-build
	docker run --rm $(DOCKER_IMAGE) test
	docker run --rm $(DOCKER_IMAGE) demo
	docker run --rm $(DOCKER_IMAGE) replay
	docker run --rm $(DOCKER_IMAGE) score
	docker run --rm $(DOCKER_IMAGE) integrity
	printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | docker run -i --rm $(DOCKER_IMAGE) mcp | grep -q codeproof_scan
