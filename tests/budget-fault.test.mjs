import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMockAgent } from "../src/agents/mock.mjs";
import { Budget } from "../src/run/index.mjs";

test("mock response prices are charged and can exceed a Budget", async function () {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-budget-"));
  try {
    const scenarioPath = join(dir, "mock-scenario.json");
    writeFileSync(scenarioPath, JSON.stringify({
      findings: [],
      costPerCall: 0.6,
      verdicts: [{ findingId: "F-001", verdict: "confirm", reason: "fixture", costUsd: 0.8 }]
    }));
    const complete = createMockAgent({ scenarioPath });
    const budget = new Budget(1);
    const scanner = await complete({ role: "scanner" });
    assert.equal(scanner.costUsd, 0.6);
    budget.charge(scanner.costUsd);
    assert.equal(budget.spentUsd, 0.6);
    assert.equal(budget.exceeded, false);
    const verifier = await complete({ role: "verifier", messages: [{ content: '"id":"F-001"' }] });
    assert.equal(verifier.costUsd, 0.8);
    budget.charge(verifier.costUsd);
    assert.equal(budget.spentUsd, 1.4);
    assert.equal(budget.calls, 2);
    assert.equal(budget.exceeded, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Budget tolerates floating point equality and still rejects a real overage", function () {
  const budget = new Budget(0.3);
  budget.charge(0.1);
  budget.charge(0.2);
  assert.equal(budget.exceeded, false);
  budget.charge(0.1);
  assert.equal(budget.exceeded, true);
});
