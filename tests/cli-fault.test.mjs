import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("cli-fault: first scanner response invalid, second valid -> exit 0, 2 scanner calls, raw saved", function () {
  const tempDir = mkdtempSync(join(tmpdir(), "codeproof-fault-retry-"));
  const fixtureDir = join(tempDir, "fixture");
  cpSync(join(repoRoot, "fixtures/mini-repo"), fixtureDir, { recursive: true });

  const scenarioPath = join(fixtureDir, "mock-scenario.json");
  const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
  scenario.scannerRaw = [
    "invalid json truncation {",
    JSON.stringify({ findings: scenario.findings })
  ];
  writeFileSync(scenarioPath, JSON.stringify(scenario, null, 2));

  const outDir = join(tempDir, "out");
  execFileSync(process.execPath, [
    join(repoRoot, "src/cli.mjs"),
    "analyze",
    fixtureDir,
    "--mock",
    "--mode",
    "demo",
    "--out",
    outDir
  ], {
    cwd: tempDir,
    timeout: 30000,
    stdio: "pipe"
  });

  const runs = readdirSync(outDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  assert.equal(runs.length, 1);

  const runJson = JSON.parse(readFileSync(join(outDir, runs[0].name, "run.json"), "utf8"));
  const scannerCalls = runJson.usage.callLog.filter((c) => c.role === "scanner");
  assert.equal(scannerCalls.length, 2);

  const rawLogPath = join(outDir, "last-scan-raw.json");
  assert.ok(existsSync(rawLogPath), "scan diagnostics must go to --out, not the process cwd");
  assert.equal(existsSync(join(tempDir, "reports", "last-scan-raw.json")), false, "scan diagnostics must not be written to the process cwd");
  const rawLog = JSON.parse(readFileSync(rawLogPath, "utf8"));
  assert.equal(rawLog.raw, "invalid json truncation {");
});

test("cli-fault: both scanner responses invalid -> exit 1, no run dir created, last raw saved", function () {
  const tempDir = mkdtempSync(join(tmpdir(), "codeproof-fault-abort-"));
  const fixtureDir = join(tempDir, "fixture");
  cpSync(join(repoRoot, "fixtures/mini-repo"), fixtureDir, { recursive: true });

  const scenarioPath = join(fixtureDir, "mock-scenario.json");
  const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
  scenario.scannerRaw = [
    "first invalid output",
    "second invalid output"
  ];
  writeFileSync(scenarioPath, JSON.stringify(scenario, null, 2));

  const outDir = join(tempDir, "out");
  let failed = false;
  try {
    execFileSync(process.execPath, [
      join(repoRoot, "src/cli.mjs"),
      "analyze",
      fixtureDir,
      "--mock",
      "--mode",
      "demo",
      "--out",
      outDir
    ], {
      cwd: tempDir,
      timeout: 30000,
      stdio: "pipe"
    });
  } catch (error) {
    failed = true;
    assert.equal(error.status, 1);
  }
  assert.ok(failed, "expected CLI process to exit with code 1");

  if (existsSync(outDir)) {
    const runs = readdirSync(outDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    assert.equal(runs.length, 0);
  }

  const rawLogPath = join(outDir, "last-scan-raw.json");
  assert.ok(existsSync(rawLogPath), "scan diagnostics must go to --out, not the process cwd");
  const rawLog = JSON.parse(readFileSync(rawLogPath, "utf8"));
  assert.equal(rawLog.raw, "second invalid output");
  assert.ok(rawLog.error);
});
