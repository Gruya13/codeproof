import test from "node:test";
import assert from "node:assert/strict";
import { computeRunId } from "../src/run/index.mjs";

const base = {
  commit: "0123456789abcdef0123456789abcdef01234567",
  configSha256: "a".repeat(64),
  models: ["muse-spark-1.3", "muse-wonder-1.0"],
  prompts: ["scanner:v1:aaa", "verifier:v1:bbb"]
};

test("run-id is deterministic and 16 hex chars", function () {
  const first = computeRunId(base);
  const second = computeRunId(base);
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{16}$/);
});

test("run-id changes with the commit", function () {
  const changed = computeRunId({ ...base, commit: "fedcba9876543210fedcba9876543210fedcba98" });
  assert.notEqual(computeRunId(base), changed);
});
