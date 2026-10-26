.PHONY: demo test

demo:
	USE_MOCK=1 node src/cli.mjs analyze fixtures/mini-repo --mock

test:
	node --test tests/
