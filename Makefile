.PHONY: demo test controlled

demo:
	USE_MOCK=1 node src/cli.mjs analyze fixtures/mini-repo --mock

test:
	node --test tests/
controlled:
	node src/cli.mjs controlled-verifier fixtures/mini-repo --candidates fixtures/mini-repo/controlled-candidates.json
