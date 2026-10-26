import test from "node:test";
import assert from "node:assert/strict";
import { createMetaAgent } from "../src/agents/meta.mjs";

function instantSleep() {
  return Promise.resolve();
}

test("meta-agent: 429 followed by 200 succeeds with retries=1 and 2 calls", async function () {
  let callCount = 0;
  const sleepCalls = [];
  const fakeFetch = async function () {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: false,
        status: 429,
        headers: new Map(),
        text: async () => "rate limited"
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "{\"findings\":[]}" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      })
    };
  };

  const agent = createMetaAgent({
    apiKey: "test-key",
    baseUrl: "https://fake.meta.ai",
    model: "muse-spark-1.3",
    maxRetries: 2,
    fetchImpl: fakeFetch,
    sleepImpl: async (ms) => { sleepCalls.push(ms); }
  });

  const result = await agent({ role: "scanner", messages: [{ role: "user", content: "test" }] });
  assert.equal(callCount, 2);
  assert.equal(result.retries, 1);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.finishReason, "stop");
  assert.equal(result.text, "{\"findings\":[]}");
  assert.equal(sleepCalls.length, 1);
});

test("meta-agent: 500 fails repeatedly up to maxRetries + 1 times and throws", async function () {
  let callCount = 0;
  const fakeFetch = async function () {
    callCount += 1;
    return {
      ok: false,
      status: 500,
      headers: new Map(),
      text: async () => "internal server error"
    };
  };

  const agent = createMetaAgent({
    apiKey: "test-key",
    baseUrl: "https://fake.meta.ai",
    model: "muse-spark-1.3",
    maxRetries: 2,
    fetchImpl: fakeFetch,
    sleepImpl: instantSleep
  });

  await assert.rejects(async () => {
    await agent({ role: "scanner", messages: [] });
  }, /HTTP 500/);

  assert.equal(callCount, 3);
});

test("meta-agent: 400 client error throws without retry (1 call, retries=0)", async function () {
  let callCount = 0;
  const fakeFetch = async function () {
    callCount += 1;
    return {
      ok: false,
      status: 400,
      headers: new Map(),
      text: async () => "bad request: invalid schema"
    };
  };

  const agent = createMetaAgent({
    apiKey: "test-key",
    baseUrl: "https://fake.meta.ai",
    model: "muse-spark-1.3",
    maxRetries: 3,
    fetchImpl: fakeFetch,
    sleepImpl: instantSleep
  });

  await assert.rejects(async () => {
    await agent({ role: "scanner", messages: [] });
  }, /HTTP 400/);

  assert.equal(callCount, 1);
});

test("meta-agent: network rejection retries up to maxRetries + 1 and throws", async function () {
  let callCount = 0;
  const fakeFetch = async function () {
    callCount += 1;
    throw new Error("fetch failed: socket hang up");
  };

  const agent = createMetaAgent({
    apiKey: "test-key",
    baseUrl: "https://fake.meta.ai",
    model: "muse-spark-1.3",
    maxRetries: 1,
    fetchImpl: fakeFetch,
    sleepImpl: instantSleep
  });

  await assert.rejects(async () => {
    await agent({ role: "scanner", messages: [] });
  }, /socket hang up/);

  assert.equal(callCount, 2);
});

test("meta-agent: 429 with retry-after header uses header value for backoff", async function () {
  let callCount = 0;
  const sleepDurations = [];
  const fakeFetch = async function () {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: false,
        status: 429,
        headers: new Map([["retry-after", "2"]]),
        text: async () => "rate limit"
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
        usage: {}
      })
    };
  };

  const agent = createMetaAgent({
    apiKey: "test-key",
    baseUrl: "https://fake.meta.ai",
    model: "muse-spark-1.3",
    maxRetries: 1,
    fetchImpl: fakeFetch,
    sleepImpl: async (ms) => { sleepDurations.push(ms); }
  });

  const res = await agent({ role: "scanner", messages: [] });
  assert.equal(res.retries, 1);
  assert.equal(sleepDurations.length, 1);
  assert.equal(sleepDurations[0], 2000);
});

test("meta-agent: characterization: 200 with invalid json throws without retry", async function () {
  let callCount = 0;
  const fakeFetch = async function () {
    callCount += 1;
    return {
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError("Unexpected token < in JSON"); }
    };
  };

  const agent = createMetaAgent({
    apiKey: "test-key",
    baseUrl: "https://fake.meta.ai",
    model: "muse-spark-1.3",
    maxRetries: 2,
    fetchImpl: fakeFetch,
    sleepImpl: instantSleep
  });

  await assert.rejects(async () => {
    await agent({ role: "scanner", messages: [] });
  }, SyntaxError);

  assert.equal(callCount, 1);
});

test("meta-agent: 200 with finish_reason content_filter throws error with code CONTENT_FILTERED", async function () {
  let callCount = 0;
  const fakeFetch = async function () {
    callCount += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "" }, finish_reason: "content_filter" }],
        usage: {}
      })
    };
  };

  const agent = createMetaAgent({
    apiKey: "test-key",
    baseUrl: "https://fake.meta.ai",
    model: "muse-spark-1.3",
    maxRetries: 2,
    fetchImpl: fakeFetch,
    sleepImpl: instantSleep
  });

  await assert.rejects(async () => {
    await agent({ role: "scanner", messages: [] });
  }, (err) => {
    assert.equal(err.code, "CONTENT_FILTERED");
    assert.match(err.message, /safety filter/);
    return true;
  });

  assert.equal(callCount, 1);
});
