.PHONY: demo test controlled bench score

demo:
	USE_MOCK=1 node src/cli.mjs analyze fixtures/mini-repo --mock

test:
	node --test tests/

controlled:
	node src/cli.mjs controlled-verifier fixtures/mini-repo --candidates fixtures/mini-repo/controlled-candidates.json

bench:
	node src/cli.mjs analyze bench/seed-repo

score:
	node bench/score.mjs bench/expected.json $(shell ls -1dt reports/*/ 2>/dev/null | grep -v archive | head -1)findings.json
