.PHONY: demo test controlled bench score replay clean-clone clean-clone-docker probe-repo ablation

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

replay:
	node scripts/replay-gates.mjs --run "$(if $(RUN),$(RUN),reports/golden)"

clean-clone:
	scripts/clean-clone.sh

clean-clone-docker:
	scripts/clean-clone-docker.sh

probe-repo:
	node scripts/probe-repo.mjs $(ARGS)

ablation:
	node scripts/ablation.mjs --repo bench/held-out
