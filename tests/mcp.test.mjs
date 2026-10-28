import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const serverPath = join(repoRoot, "src/mcp/index.mjs");

function createSession(t) {
  const child = spawn(process.execPath, [serverPath], { cwd: repoRoot, stdio: ["pipe", "pipe", "pipe"] });
  const pending = [];
  let buffer = "";
  child.stdout.on("data", function (chunk) {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line === "") continue;
      const waiter = pending.shift();
      if (waiter) waiter(JSON.parse(line));
    }
  });
  t.after(function () { child.kill(); });
  function request(message) {
    return new Promise(function (resolve) {
      pending.push(resolve);
      child.stdin.write(JSON.stringify(message) + "\n");
    });
  }
  return { request: request, child: child };
}

test("MCP: initialize, tools/list and ping work over stdio", async function (t) {
  const session = createSession(t);
  const init = await session.request({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } });
  assert.equal(init.result.protocolVersion, "2024-11-05");
  assert.equal(init.result.serverInfo.name, "codeproof");
  assert.ok(init.result.capabilities.tools);
  const ping = await session.request({ jsonrpc: "2.0", id: 2, method: "ping" });
  assert.deepEqual(ping.result, {});
  const list = await session.request({ jsonrpc: "2.0", id: 3, method: "tools/list" });
  assert.deepEqual(list.result.tools.map(function (tool) { return tool.name; }).sort(), ["codeproof_replay", "codeproof_scan"]);
  for (const tool of list.result.tools) assert.equal(tool.inputSchema.type, "object");
});

test("MCP: unknown methods and tools return JSON-RPC errors", async function (t) {
  const session = createSession(t);
  const unknownMethod = await session.request({ jsonrpc: "2.0", id: 1, method: "no/such" });
  assert.equal(unknownMethod.error.code, -32601);
  const unknownTool = await session.request({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "nope", arguments: {} } });
  assert.equal(unknownTool.error.code, -32601);
  const badArgs = await session.request({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "codeproof_replay", arguments: {} } });
  assert.equal(badArgs.error.code, -32603);
  assert.match(badArgs.error.message, /reportDir is required/);
});

test("MCP: codeproof_scan runs the demo pipeline and returns a findings summary", async function (t) {
  const session = createSession(t);
  const result = await session.request({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "codeproof_scan", arguments: { path: "fixtures/mini-repo", mock: true } } });
  assert.equal(result.result.content[0].type, "text");
  const payload = JSON.parse(result.result.content[0].text);
  assert.ok(payload.reportDir);
  assert.equal(payload.mode, "demo");
  assert.ok(payload.verified.length >= 1);
  assert.ok(payload.findings.proposed >= 1);
});

test("MCP: codeproof_replay replays a demo report offline", async function (t) {
  const session = createSession(t);
  const scan = await session.request({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "codeproof_scan", arguments: { path: "fixtures/mini-repo", mock: true } } });
  const reportDir = JSON.parse(scan.result.content[0].text).reportDir;
  const replay = await session.request({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "codeproof_replay", arguments: { reportDir: reportDir } } });
  const payload = JSON.parse(replay.result.content[0].text);
  assert.equal(payload.mode, "v2");
  assert.equal(payload.matches, true, JSON.stringify(payload.problems));
  assert.match(payload.resultHash, /^[0-9a-f]{64}$/);
});