#!/usr/bin/env node
// Minimal MCP server (F4.2): JSON-RPC 2.0 over node:readline on stdin/stdout, zero dependencies.
// Exposes two tools - codeproof_scan and codeproof_replay - and nothing else. Errors are returned
// as JSON-RPC errors; the server never writes to stdout except protocol messages.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { replayRun } from "../run/replay.mjs";

export const SERVER_INFO = { name: "codeproof", version: "0.2.1" };
export const PROTOCOL_VERSION = "2024-11-05";

export const TOOLS = [
  {
    name: "codeproof_scan",
    description: "Run CodeProof on a local repository (mock adapter, no network) and return the findings summary.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "path to the local repository or directory to analyze" },
        mock: { type: "boolean", description: "use the deterministic mock adapter (default true)" }
      },
      required: ["path"]
    }
  },
  {
    name: "codeproof_replay",
    description: "Mechanically replay a v2 CodeProof report offline (attestation, L1-L4) and return the result.",
    inputSchema: {
      type: "object",
      properties: {
        reportDir: { type: "string", description: "path to a report directory containing run.json and findings.json" },
        anchor: { type: "string", description: "optional git revision to anchor the report against" }
      },
      required: ["reportDir"]
    }
  }
];

function textResult(text) {
  return { content: [{ type: "text", text: text }] };
}

function runScan(path, mock) {
  return new Promise(function (resolve, reject) {
    const outDir = mkdtempSync(join(tmpdir(), "codeproof-mcp-scan-"));
    const args = [join(import.meta.dirname || process.cwd(), "..", "cli.mjs"), "analyze", path, "--out", outDir];
    if (mock !== false) args.push("--mock");
    const child = spawn(process.execPath, args, { env: Object.assign({}, process.env, { USE_MOCK: mock === false ? "0" : "1", MOCK_PIPELINE: "1" }), stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", function (chunk) { output += chunk; });
    child.stderr.on("data", function (chunk) { output += chunk; });
    child.on("error", reject);
    child.on("close", function (code) {
      if (code !== 0) { reject(new Error("codeproof_scan failed (exit " + code + "): " + output.slice(-800))); return; }
      try {
        const runName = readdirSync(outDir, { withFileTypes: true }).find(function (entry) { return entry.isDirectory(); }).name;
        const reportDir = join(outDir, runName);
        const findings = JSON.parse(readFileSync(join(reportDir, "findings.json"), "utf8"));
        const run = JSON.parse(readFileSync(join(reportDir, "run.json"), "utf8"));
        resolve(textResult(JSON.stringify({ reportDir: reportDir, runId: run.runId, mode: run.mode, findings: run.findings, verified: findings.map(function (item) { return { id: item.finding.id, status: item.status, evidenceLevel: item.evidenceLevel, title: item.finding.title }; }) }, null, 2)));
      } catch (error) {
        reject(new Error("codeproof_scan could not read its output: " + error.message));
      }
    });
  });
}

async function callTool(name, args) {
  if (name === "codeproof_scan") {
    if (!args || typeof args.path !== "string" || args.path.trim() === "") throw new Error("path is required");
    return runScan(args.path, args.mock);
  }
  if (name === "codeproof_replay") {
    if (!args || typeof args.reportDir !== "string" || args.reportDir.trim() === "") throw new Error("reportDir is required");
    const result = await replayRun({ reportDir: args.reportDir, anchor: args.anchor || null });
    return textResult(JSON.stringify({ mode: result.mode, matches: result.matches, problems: result.problems, mismatches: result.mismatches, resultHash: result.resultHash, findings: result.findings }, null, 2));
  }
  throw Object.assign(new Error("unknown tool: " + name), { code: -32601 });
}

export async function handleMessage(message) {
  if (!message || typeof message !== "object" || message.jsonrpc !== "2.0") return { jsonrpc: "2.0", id: message && message.id !== undefined ? message.id : null, error: { code: -32600, message: "invalid JSON-RPC request" } };
  const isNotification = message.id === undefined;
  const respond = function (payload) { return isNotification ? null : Object.assign({ jsonrpc: "2.0", id: message.id }, payload); };
  try {
    if (message.method === "initialize") {
      return respond({ result: { protocolVersion: (message.params && message.params.protocolVersion) || PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO } });
    }
    if (message.method === "ping") return respond({ result: {} });
    if (message.method === "tools/list") return respond({ result: { tools: TOOLS } });
    if (message.method === "tools/call") {
      const params = message.params || {};
      return respond({ result: await callTool(params.name, params.arguments || {}) });
    }
    return respond({ error: { code: -32601, message: "method not found: " + message.method } });
  } catch (error) {
    return respond({ error: { code: error.code && error.code < 0 ? error.code : -32603, message: error.message } });
  }
}

export async function startServer(input, output) {
  const rl = createInterface({ input: input, crlfDelay: Infinity });
  rl.on("line", async function (line) {
    const trimmed = line.trim();
    if (trimmed === "") return;
    let message;
    try { message = JSON.parse(trimmed); } catch (error) {
      output.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }) + "\n");
      return;
    }
    const response = await handleMessage(message);
    if (response) output.write(JSON.stringify(response) + "\n");
  });
  return rl;
}

if (process.argv[1] && process.argv[1].endsWith("mcp/index.mjs")) {
  mkdirSync(tmpdir(), { recursive: true });
  startServer(process.stdin, process.stdout);
}