import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import {
  checkCitation,
  applyVerdict,
  buildVerifierMessages,
  STRONG_REFUTE_RESPONSE_FORMAT,
  VERIFIER_SYSTEM_PROMPT,
  validateVerdictsL0,
  verifyOne
} from "../src/verify/index.mjs";

/**
 * Pomoćna funkcija za kreiranje privremenog direktorijuma / git repozitorijuma.
 */
function createTempRepo({ withGit = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-l2-"));
  if (withGit) {
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "test"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: dir });
  }
  return {
    dir,
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

/**
 * Pomoćna funkcija za mock agenta.
 */
function createFakeAgent(responses = []) {
  const calls = [];
  let index = 0;
  return {
    calls,
    async complete(request) {
      calls.push(request);
      const current = responses[index++] || { text: "" };
      const text = typeof current === "string" ? current : current.text;
      return {
        text: text !== undefined ? text : JSON.stringify(current),
        usage: { inputTokens: 100, outputTokens: 50, cachedTokens: 0 },
        costUsd: 0,
        model: "fake-agent",
        latencyMs: 1,
        retries: 0,
        finishReason: current.finishReason || "stop"
      };
    }
  };
}

// ============================================================================
// L1 KAPIJA — checkCitation(evidence, repo)
// ============================================================================

test("T-B1: CRLF file with LF snippet, and LF file with CRLF snippet", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  writeFileSync(join(dir, "crlf.txt"), "line1\r\nline2\r\nline3\r\n", "utf8");
  writeFileSync(join(dir, "lf.txt"), "lineA\nlineB\nlineC\n", "utf8");

  const repo = {
    root: dir,
    manifest: new Map([
      ["crlf.txt", { path: "crlf.txt" }],
      ["lf.txt", { path: "lf.txt" }]
    ])
  };

  // CRLF fajl na disku, snippet koristi LF
  const res1 = checkCitation(
    { path: "crlf.txt", startLine: 1, endLine: 3, snippet: "line1\nline2\nline3" },
    repo
  );
  assert.equal(res1.passed, true);
  assert.equal(res1.lineTolerance, 0);

  // LF fajl na disku, snippet koristi CRLF
  const res2 = checkCitation(
    { path: "lf.txt", startLine: 1, endLine: 3, snippet: "lineA\r\nlineB\r\nlineC" },
    repo
  );
  assert.equal(res2.passed, true);
  assert.equal(res2.lineTolerance, 0);
});

test("T-B2: snippet shifted by -1 line (citat počinje na liniji 4 umesto 5) passes with lineTolerance=1", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n");
  writeFileSync(join(dir, "target.txt"), lines, "utf8");

  const repo = {
    root: dir,
    manifest: new Map([["target.txt", { path: "target.txt" }]])
  };

  // Citat deklariše startLine 4, ali snippet odgovara linijama 5..6 (pomeraj -1 od stvarnog)
  const evidence = {
    path: "target.txt",
    startLine: 4,
    endLine: 5,
    snippet: "line 5\nline 6"
  };

  const res = checkCitation(evidence, repo);
  assert.equal(res.passed, true);
  assert.equal(res.lineTolerance, 1);
});

test("T-B3: snippet shifted by -2 and +2 lines fails without calling model", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  const lines = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join("\n");
  writeFileSync(join(dir, "target.txt"), lines, "utf8");

  const repo = {
    root: dir,
    manifest: new Map([["target.txt", { path: "target.txt" }]])
  };

  // Snippet je zapravo linija 7..8
  const snippet = "line 7\nline 8";

  // Pomeren za -2 linije (navedeno 5 umesto 7)
  const resMinus2 = checkCitation(
    { path: "target.txt", startLine: 5, endLine: 6, snippet },
    repo
  );
  assert.equal(resMinus2.passed, false);

  // Pomeren za +2 linije (navedeno 9 umesto 7)
  const resPlus2 = checkCitation(
    { path: "target.txt", startLine: 9, endLine: 10, snippet },
    repo
  );
  assert.equal(resPlus2.passed, false);
});

test("T-B4: identical block repeated 3 times; citations at 1st and 2nd occurrence pass; shifted +/-2 from 3rd occurrence fails", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  // Identičan catch blok na linijama 2, 7 i 12
  const fileContent = [
    "function one() {",
    "  catch (e) { log(e); }", // linija 2
    "}",
    "function two() {",
    "  let a = 1;",
    "  let b = 2;",
    "  catch (e) { log(e); }", // linija 7
    "}",
    "function three() {",
    "  let x = 10;",
    "  let y = 20;",
    "  catch (e) { log(e); }", // linija 12
    "}"
  ].join("\n");

  writeFileSync(join(dir, "repeats.js"), fileContent, "utf8");

  const repo = {
    root: dir,
    manifest: new Map([["repeats.js", { path: "repeats.js" }]])
  };

  const snippet = "  catch (e) { log(e); }";

  // 1. pojava (linija 2) -> prolazi
  const res1 = checkCitation({ path: "repeats.js", startLine: 2, endLine: 2, snippet }, repo);
  assert.equal(res1.passed, true);

  // 2. pojava (linija 7) -> prolazi
  const res2 = checkCitation({ path: "repeats.js", startLine: 7, endLine: 7, snippet }, repo);
  assert.equal(res2.passed, true);

  // Pomeren za -2 u odnosu na 3. pojavu (linija 10) -> PADA (dokazuje da ne skenira ceo fajl)
  const res3Minus2 = checkCitation({ path: "repeats.js", startLine: 10, endLine: 10, snippet }, repo);
  assert.equal(res3Minus2.passed, false);

  // Pomeren za +2 u odnosu na 3. pojavu (linija 14) -> PADA
  const res3Plus2 = checkCitation({ path: "repeats.js", startLine: 14, endLine: 14, snippet }, repo);
  assert.equal(res3Plus2.passed, false);
});

test("T-B5: snippet trimming at ends, interior blank line preservation, and whitespace/tab normalization", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  const fileContent = [
    "function foo() {",
    "",
    "\tconst x = 42;   ",
    "}"
  ].join("\n");

  writeFileSync(join(dir, "ws.js"), fileContent, "utf8");

  const repo = {
    root: dir,
    manifest: new Map([["ws.js", { path: "ws.js" }]])
  };

  // Snippet sa praznim linijama na krajevima, razmacima umesto taba i bez trailing spaces
  const snippetNormalized = "\n\nfunction foo() {\n\n    const x = 42;\n}\n\n";
  const resPass = checkCitation(
    { path: "ws.js", startLine: 1, endLine: 4, snippet: snippetNormalized },
    repo
  );
  assert.equal(resPass.passed, true);

  // Snippet kome nedostaje unutrašnja prazna linija mora da padne
  const snippetMissingInteriorBlank = "function foo() {\n    const x = 42;\n}";
  const resFail = checkCitation(
    { path: "ws.js", startLine: 1, endLine: 4, snippet: snippetMissingInteriorBlank },
    repo
  );
  assert.equal(resFail.passed, false);
});

test("T-B6: BOM at start of file, file without trailing newline; first and last line citations pass without crash", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  // Fajl sa UTF-8 BOM na početku i bez završnog newline-a
  const fileContent = "\uFEFFstartLineCode();\nmiddleLine();\nendLineCode();";
  writeFileSync(join(dir, "bom.js"), fileContent, "utf8");

  const repo = {
    root: dir,
    manifest: new Map([["bom.js", { path: "bom.js" }]])
  };

  // Citat prve linije
  const resFirst = checkCitation(
    { path: "bom.js", startLine: 1, endLine: 1, snippet: "startLineCode();" },
    repo
  );
  assert.equal(resFirst.passed, true);

  // Citat poslednje linije
  const resLast = checkCitation(
    { path: "bom.js", startLine: 3, endLine: 3, snippet: "endLineCode();" },
    repo
  );
  assert.equal(resLast.passed, true);
});

test("T-B7: 15 lines passes, 16 lines fails, endLine < startLine fails, endLine > len(file) fails", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  const lines = Array.from({ length: 25 }, (_, i) => `item_${i + 1};`);
  writeFileSync(join(dir, "len.js"), lines.join("\n"), "utf8");

  const repo = {
    root: dir,
    manifest: new Map([["len.js", { path: "len.js" }]])
  };

  // 15 linija -> prolazi
  const res15 = checkCitation(
    { path: "len.js", startLine: 1, endLine: 15, snippet: lines.slice(0, 15).join("\n") },
    repo
  );
  assert.equal(res15.passed, true);

  // 16 linija -> pada
  const res16 = checkCitation(
    { path: "len.js", startLine: 1, endLine: 16, snippet: lines.slice(0, 16).join("\n") },
    repo
  );
  assert.equal(res16.passed, false);
  assert.match(res16.reason, /wider than 15 lines/);

  // Prijavljeni raspon je kratak, ali stvarni snippet ne sme zaobići limit.
  const res15ShortRange = checkCitation(
    { path: "len.js", startLine: 1, endLine: 1, snippet: lines.slice(0, 15).join("\n") },
    repo
  );
  assert.equal(res15ShortRange.passed, false);
  assert.match(res15ShortRange.reason, /expects 1 lines but snippet has 15 lines/);

  const res16ShortRange = checkCitation(
    { path: "len.js", startLine: 1, endLine: 1, snippet: lines.slice(0, 16).join("\n") },
    repo
  );
  assert.equal(res16ShortRange.passed, false);
  assert.match(res16ShortRange.reason, /wider than 15 lines/);

  // endLine < startLine -> pada
  const resInverted = checkCitation(
    { path: "len.js", startLine: 10, endLine: 5, snippet: lines.slice(4, 10).join("\n") },
    repo
  );
  assert.equal(resInverted.passed, false);
  assert.match(resInverted.reason, /invalid line range/);

  // endLine > len(file) -> pada
  const resOverflow = checkCitation(
    { path: "len.js", startLine: 20, endLine: 30, snippet: lines.slice(19, 25).join("\n") },
    repo
  );
  assert.equal(resOverflow.passed, false);
  assert.match(resOverflow.reason, /exceeds file length/);
});

test("T-B8: path traversal and unmanifested files fail without reading outside repo", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  writeFileSync(join(dir, "valid.js"), "const ok = true;\n", "utf8");
  writeFileSync(join(dir, "secret.js"), "const secret = true;\n", "utf8");

  const repo = {
    root: dir,
    manifest: new Map([["valid.js", { path: "valid.js" }]]) // secret.js namerno nije u manifestu
  };

  const traversalPatterns = [
    "../secret.js",
    "/etc/passwd",
    "src/../../secret.js"
  ];

  for (const badPath of traversalPatterns) {
    const res = checkCitation(
      { path: badPath, startLine: 1, endLine: 1, snippet: "const secret = true;" },
      repo
    );
    assert.equal(res.passed, false);
    assert.match(res.reason, /relative and must not contain \.\./);
  }

  // Fajl koji postoji na disku u repozitorijumu, ali nije u manifestu
  const resUnmanifested = checkCitation(
    { path: "secret.js", startLine: 1, endLine: 1, snippet: "const secret = true;" },
    repo
  );
  assert.equal(resUnmanifested.passed, false);
  assert.match(resUnmanifested.reason, /not in the repo manifest/);
});

test("T-B9: git blob reads old content when commit sha is passed, reads disk when commit is omitted", (t) => {
  const { dir, cleanup } = createTempRepo({ withGit: true });
  t.after(cleanup);

  const filePath = "tracked.txt";
  const fullPath = join(dir, filePath);

  writeFileSync(fullPath, "commit content line\n", "utf8");
  execFileSync("git", ["add", filePath], { cwd: dir });
  execFileSync(
    "git",
    ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-q", "-m", "init"],
    { cwd: dir }
  );

  const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();

  // Modifikujemo fajl na disku
  writeFileSync(fullPath, "modified on disk line\n", "utf8");

  const manifest = new Map([[filePath, { path: filePath }]]);

  // Sa commit SHA -> mora čitati commit blob (stari sadržaj)
  const repoWithCommit = { root: dir, manifest, commit: commitSha };
  const resBlobOld = checkCitation(
    { path: filePath, startLine: 1, endLine: 1, snippet: "commit content line" },
    repoWithCommit
  );
  assert.equal(resBlobOld.passed, true);

  const resBlobNew = checkCitation(
    { path: filePath, startLine: 1, endLine: 1, snippet: "modified on disk line" },
    repoWithCommit
  );
  assert.equal(resBlobNew.passed, false);

  // Bez commit SHA -> mora čitati radni direktorijum (novi sadržaj)
  const repoWithoutCommit = { root: dir, manifest };
  const resDiskNew = checkCitation(
    { path: filePath, startLine: 1, endLine: 1, snippet: "modified on disk line" },
    repoWithoutCommit
  );
  assert.equal(resDiskNew.passed, true);

  const resDiskOld = checkCitation(
    { path: filePath, startLine: 1, endLine: 1, snippet: "commit content line" },
    repoWithoutCommit
  );
  assert.equal(resDiskOld.passed, false);
});

test("T-B10: L1 failure causes verifyOne to reject early without calling agent", async (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  const repo = {
    root: dir,
    manifest: new Map()
  };

  const agent = createFakeAgent([
    {
      text: JSON.stringify({
        verdicts: [{ findingId: "F-001", verdict: "confirm", reason: "Agent should never run" }]
      })
    }
  ]);

  const finding = {
    id: "F-001",
    evidence: [
      { path: "missing.js", startLine: 1, endLine: 1, snippet: "none" }
    ]
  };

  const result = await verifyOne({
    finding,
    repo,
    agent,
    excerpts: "",
    maxTokens: 2000
  });

  assert.equal(agent.calls.length, 0, "Agent must not be invoked when L1 check fails");
  assert.equal(result.status, "l1-rejected");
  assert.equal(result.l1.passed, false);
});

// ============================================================================
// L2 KAPIJA — applyVerdict(...) / validateVerdictsL0(...)
// ============================================================================

test("T-B11: strong refute with valid counter-citation yields 'refuted' status and counterEvidenceL1.passed=true", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  writeFileSync(join(dir, "auth.js"), "if (!user) return unauthorized();\n", "utf8");
  writeFileSync(join(dir, "request.js"), "const user = request.user;\n", "utf8");

  const repo = {
    root: dir,
    manifest: new Map([["auth.js", { path: "auth.js" }], ["request.js", { path: "request.js" }]])
  };
  const finding = { id: "F-001", evidence: [{ path: "request.js", startLine: 1, endLine: 1, snippet: "const user = request.user;" }] };
  const excerpts = "### request.js\n1 | const user = request.user;\n### auth.js\n1 | if (!user) return unauthorized();";

  const verdict = {
    findingId: "F-001",
    verdict: "refute",
    mode: "strong",
    reason: "Auth check is present at auth.js:1.",
    counterEvidence: [
      { path: "auth.js", startLine: 1, endLine: 1, snippet: "if (!user) return unauthorized();" }
    ]
  };

  const result = applyVerdict(verdict, "test-model", repo, finding, excerpts);
  assert.equal(result.status, "refuted");
  assert.equal(result.verifier.mode, "strong");
  assert.equal(result.verifier.counterEvidenceL1.passed, true);
});

test("T-B12: strong refute with false snippet yields 'moderate' status and counterEvidenceL1.passed=false", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  writeFileSync(join(dir, "auth.js"), "if (!user) return unauthorized();\n", "utf8");

  const repo = {
    root: dir,
    manifest: new Map([["auth.js", { path: "auth.js" }]])
  };
  const finding = { id: "F-001", evidence: [{ path: "auth.js", startLine: 1, endLine: 1, snippet: "if (!user) return unauthorized();" }] };
  const excerpts = "### auth.js\n1 | if (!user) return unauthorized();";

  const verdict = {
    findingId: "F-001",
    verdict: "refute",
    mode: "strong",
    reason: "Fabricated check at auth.js:1.",
    counterEvidence: [
      { path: "auth.js", startLine: 1, endLine: 1, snippet: "if (user.isAdmin()) return ok();" }
    ]
  };

  const result = applyVerdict(verdict, "test-model", repo, finding, excerpts);
  assert.equal(result.status, "moderate");
  assert.notEqual(result.status, "refuted");
  assert.equal(result.verifier.counterEvidenceL1.passed, false);
});

test("strong refute without finding or verifier excerpts fails closed", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);
  writeFileSync(join(dir, "target.js"), "const user = request.user;\nif (!user) return unauthorized();\n", "utf8");
  const repo = { root: dir, manifest: new Map([["target.js", { path: "target.js" }]]) };
  const finding = { id: "F-001", evidence: [{ path: "target.js", startLine: 1, endLine: 1, snippet: "const user = request.user;" }] };
  const excerpts = "### target.js\n1 | const user = request.user;\n2 | if (!user) return unauthorized();";
  const verdict = {
    findingId: "F-001", verdict: "refute", mode: "strong", reason: "The guard exists at target.js:2.",
    counterEvidence: [{ path: "target.js", startLine: 2, endLine: 2, snippet: "if (!user) return unauthorized();" }]
  };

  const noExcerpts = applyVerdict(verdict, "test-model", repo, finding);
  assert.equal(noExcerpts.verifier.counterEvidenceL1.passed, true);
  assert.equal(noExcerpts.status, "moderate");
  assert.equal(noExcerpts.verifier.counterEvidencePolicy.inContext, false);

  const noFinding = applyVerdict(verdict, "test-model", repo, null, excerpts);
  assert.equal(noFinding.status, "moderate");
  assert.equal(noFinding.verifier.counterEvidencePolicy.inContext, false);
});

test("T-B13: refute degradations: empty counterEvidence, missing mode, and weak mode all degrade to 'moderate'", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  const repo = {
    root: dir,
    manifest: new Map()
  };

  // (a) strong refute sa counterEvidence: [] -> L0 normalizuje u weak, applyVerdict vraća moderate
  const rawA = {
    verdicts: [
      { findingId: "F-001", verdict: "refute", mode: "strong", reason: "Valid reason over 10 chars", counterEvidence: [] }
    ]
  };
  const valA = validateVerdictsL0(rawA);
  assert.equal(valA.ok, true);
  assert.equal(valA.verdicts[0].mode, "weak");

  const resA = applyVerdict(valA.verdicts[0], "test-model", repo, { id: "F-001", evidence: [] }, "");
  assert.equal(resA.status, "moderate");

  // (b) refute bez mode -> L0 postavlja mode na weak
  const rawB = {
    verdicts: [
      { findingId: "F-002", verdict: "refute", reason: "Valid reason over 10 chars without mode" }
    ]
  };
  const valB = validateVerdictsL0(rawB);
  assert.equal(valB.ok, true);
  assert.equal(valB.verdicts[0].mode, "weak");

  const resB = applyVerdict(valB.verdicts[0], "test-model", repo, { id: "F-002", evidence: [] }, "");
  assert.equal(resB.status, "moderate");

  // (c) eksplicitno weak refute -> status moderate
  const verdictC = {
    findingId: "F-003",
    verdict: "refute",
    mode: "weak",
    reason: "Valid reason over 10 chars explaining weak refute"
  };
  const resC = applyVerdict(verdictC, "test-model", repo, { id: "F-003", evidence: [] }, "");
  assert.equal(resC.status, "moderate");
});

test("T-B14a: strong refute from manifest file absent in verifier context degrades to 'moderate' (F8 inContext=false)", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  writeFileSync(join(dir, "outside_context.js"), "export const safe = true;\n", "utf8");
  writeFileSync(join(dir, "inside_context.js"), "const query = req.query;\n", "utf8");

  const repo = {
    root: dir,
    manifest: new Map([
      ["outside_context.js", { path: "outside_context.js" }],
      ["inside_context.js", { path: "inside_context.js" }]
    ])
  };

  const finding = {
    id: "F-001",
    evidence: [
      { path: "inside_context.js", startLine: 1, endLine: 1, snippet: "const query = req.query;" }
    ]
  };

  const excerpts = "### inside_context.js - cited file\n   1 | const query = req.query;";

  const verdict = {
    findingId: "F-001",
    verdict: "refute",
    mode: "strong",
    reason: "Cited code from repo file that was not in scanner context.",
    counterEvidence: [
      { path: "outside_context.js", startLine: 1, endLine: 1, snippet: "export const safe = true;" }
    ]
  };

  // Posle F8: citat prolazi L1 (fajl postoji na disku), ali pada F8 policy jer nije u excerpts
  const result = applyVerdict(verdict, "test-model", repo, finding, excerpts);
  assert.equal(result.status, "moderate");
  assert.equal(result.verifier.mode, "strong");
  assert.equal(result.verifier.counterEvidenceL1.passed, true);
  assert.equal(result.verifier.counterEvidencePolicy.inContext, false);
});

test("T-B14b: characterization — unrelated counter-citation inside context still yields 'refuted' (Z5 residual risk)", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  const fileContent = [
    "const query = req.query.id;",
    "const db = connect();",
    "export const unrelatedConst = 42;"
  ].join("\n");
  writeFileSync(join(dir, "handler.js"), fileContent, "utf8");

  const repo = {
    root: dir,
    manifest: new Map([["handler.js", { path: "handler.js" }]])
  };

  const finding = {
    id: "F-001",
    evidence: [
      { path: "handler.js", startLine: 1, endLine: 1, snippet: "const query = req.query.id;" }
    ]
  };

  const excerpts = [
    "### handler.js - cited file",
    "   1 | const query = req.query.id;",
    "   2 | const db = connect();",
    "   3 | export const unrelatedConst = 42;"
  ].join("\n");

  const verdict = {
    findingId: "F-001",
    verdict: "refute",
    mode: "strong",
    reason: "Refuting with unrelated line 3 from within bounded context.",
    counterEvidence: [
      { path: "handler.js", startLine: 3, endLine: 3, snippet: "export const unrelatedConst = 42;" }
    ]
  };

  // F8 proverava samo kontekst i različitost; semantički nepovezan citat unutar konteksta i dalje prolazi
  const result = applyVerdict(verdict, "test-model", repo, finding, excerpts);
  assert.equal(result.status, "refuted");
  assert.equal(result.verifier.counterEvidenceL1.passed, true);
  assert.equal(result.verifier.counterEvidencePolicy.inContext, true);
  assert.equal(result.verifier.counterEvidencePolicy.distinctFromCitation, true);
});

test("T-B15: strong refute identical to finding citation degrades to 'moderate' (F8 distinctFromCitation=false)", (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  writeFileSync(join(dir, "target.js"), "const secret = process.env.API_KEY;\n", "utf8");

  const repo = {
    root: dir,
    manifest: new Map([["target.js", { path: "target.js" }]])
  };

  const finding = {
    id: "F-001",
    evidence: [
      { path: "target.js", startLine: 1, endLine: 1, snippet: "const secret = process.env.API_KEY;" }
    ]
  };

  const excerpts = "### target.js - cited file\n   1 | const secret = process.env.API_KEY;";

  const verdict = {
    findingId: "F-001",
    verdict: "refute",
    mode: "strong",
    reason: "Verifier quotes the exact same line as the finding.",
    counterEvidence: [
      { path: "target.js", startLine: 1, endLine: 1, snippet: "const secret = process.env.API_KEY;" }
    ]
  };

  // Posle F8: protiv-citat identičan citatu nalaza ne sme oboriti nalaz
  const result = applyVerdict(verdict, "test-model", repo, finding, excerpts);
  assert.equal(result.status, "moderate");
  assert.equal(result.verifier.mode, "strong");
  assert.equal(result.verifier.counterEvidenceL1.passed, true);
  assert.equal(result.verifier.counterEvidencePolicy.distinctFromCitation, false);
});

test("T-B16: confirm -> 'verified', uncertain -> 'uncertain', mismatched findingId -> 'uncertain'", async (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  writeFileSync(join(dir, "index.js"), "const a = 1;\n", "utf8");
  const repo = {
    root: dir,
    manifest: new Map([["index.js", { path: "index.js" }]])
  };
  const finding = {
    id: "F-001",
    evidence: [
      { path: "index.js", startLine: 1, endLine: 1, snippet: "const a = 1;" }
    ]
  };
  const excerpts = "const a = 1;";

  // Direct applyVerdict assertions
  const resConfirm = applyVerdict(
    { findingId: "F-001", verdict: "confirm", reason: "Valid reason over 10 chars" },
    "test-model",
    repo,
    finding,
    excerpts
  );
  assert.equal(resConfirm.status, "verified");

  const resUncertain = applyVerdict(
    { findingId: "F-001", verdict: "uncertain", reason: "Valid reason over 10 chars" },
    "test-model",
    repo,
    finding,
    excerpts
  );
  assert.equal(resUncertain.status, "uncertain");

  // verifyOne gde agent vrati odgovor za pogrešan findingId (F-999 umesto F-001)
  const agent = createFakeAgent([
    {
      text: JSON.stringify({
        verdicts: [
          { findingId: "F-999", verdict: "confirm", reason: "Verdict for foreign findingId" }
        ]
      })
    }
  ]);

  const res = await verifyOne({ finding, repo, agent, excerpts: excerpts, maxTokens: 1000 });
  assert.equal(res.status, "uncertain");
  assert.match(res.verifier.reason, /no verdict for this finding/);
});

test("T-B17: L0 validation failures (short reason, invalid ID, counterEvidence on confirm) degrade to 'uncertain' without throwing", async (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  writeFileSync(join(dir, "code.js"), "const val = 100;\n", "utf8");
  const repo = {
    root: dir,
    manifest: new Map([["code.js", { path: "code.js" }]])
  };

  const finding = {
    id: "F-001",
    evidence: [{ path: "code.js", startLine: 1, endLine: 1, snippet: "const val = 100;" }]
  };

  // 1. reason kraći od 10 znakova
  const badReason = { verdicts: [{ findingId: "F-001", verdict: "confirm", reason: "short" }] };
  assert.equal(validateVerdictsL0(badReason).ok, false);

  const res1 = await verifyOne({
    finding,
    repo,
    agent: createFakeAgent([badReason]),
    excerpts: "const val = 100;",
    maxTokens: 1000
  });
  assert.equal(res1.status, "uncertain");
  assert.match(res1.verifier.reason, /failed L0/);

  // 2. nevalidan findingId
  const badId = { verdicts: [{ findingId: "NOT_AN_ID", verdict: "confirm", reason: "Valid length reason here" }] };
  assert.equal(validateVerdictsL0(badId).ok, false);

  const res2 = await verifyOne({
    finding,
    repo,
    agent: createFakeAgent([badId]),
    excerpts: "const val = 100;",
    maxTokens: 1000
  });
  assert.equal(res2.status, "uncertain");
  assert.match(res2.verifier.reason, /failed L0/);

  // 3. counterEvidence priložen uz 'confirm'
  const confirmWithCounter = {
    verdicts: [
      {
        findingId: "F-001",
        verdict: "confirm",
        reason: "Valid reason over 10 chars",
        counterEvidence: [{ path: "code.js", startLine: 1, endLine: 1, snippet: "const val = 100;" }]
      }
    ]
  };
  assert.equal(validateVerdictsL0(confirmWithCounter).ok, false);

  const res3 = await verifyOne({
    finding,
    repo,
    agent: createFakeAgent([confirmWithCounter]),
    excerpts: "const val = 100;",
    maxTokens: 1000
  });
  assert.equal(res3.status, "uncertain");
  assert.match(res3.verifier.reason, /failed L0/);
});

test("T-B18: verifyOne empty response triggers retry with 2x maxTokens; double empty yields 'uncertain'", async (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  writeFileSync(join(dir, "target.js"), "export function run() {}\n", "utf8");
  const repo = {
    root: dir,
    manifest: new Map([["target.js", { path: "target.js" }]])
  };

  const agent = createFakeAgent([
    { text: "" }, // 1. prazan odgovor
    { text: "" }  // 2. ponovo prazan odgovor
  ]);

  const finding = {
    id: "F-001",
    evidence: [{ path: "target.js", startLine: 1, endLine: 1, snippet: "export function run() {}" }]
  };

  const initialMaxTokens = 1500;
  const result = await verifyOne({
    finding,
    repo,
    agent,
    excerpts: "export function run() {}",
    maxTokens: initialMaxTokens
  });

  assert.equal(agent.calls.length, 2);
  assert.equal(agent.calls[0].maxTokens, 1500);
  assert.equal(agent.calls[1].maxTokens, 3000); // 2x maxTokens
  assert.equal(result.status, "uncertain");
});

test("T-B19: weak refute triggers strong-refute retry; promotes to 'refuted' on valid counter-citation or stays 'moderate'", async (t) => {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);

  writeFileSync(join(dir, "guard.js"), "const val = input.val;\nif (val == null) return fallback;\n", "utf8");
  const repo = {
    root: dir,
    manifest: new Map([["guard.js", { path: "guard.js" }]])
  };

  const finding = {
    id: "F-001",
    evidence: [{ path: "guard.js", startLine: 1, endLine: 1, snippet: "const val = input.val;" }]
  };

  // Scenario 1: Retry uspeva sa strong refute i validnim protiv-citatom -> status postaje 'refuted'
  const agentSuccess = createFakeAgent([
    {
      text: JSON.stringify({
        verdicts: [{ findingId: "F-001", verdict: "refute", mode: "weak", reason: "Weak reasoning on pass 1" }]
      })
    },
    {
      text: JSON.stringify({
        verdicts: [
          {
            findingId: "F-001",
            verdict: "refute",
            mode: "strong",
            reason: "Counter-evidence at guard.js:1.",
            counterEvidence: [{ path: "guard.js", startLine: 2, endLine: 2, snippet: "if (val == null) return fallback;" }]
          }
        ]
      })
    }
  ]);

  const resSuccess = await verifyOne({
    finding,
    repo,
    agent: agentSuccess,
    excerpts: "   1 | const val = input.val;\n   2 | if (val == null) return fallback;",
    maxTokens: 2000
  });

  assert.equal(agentSuccess.calls.length, 2, "Must trigger second call for strong-refute retry");
  assert.equal(resSuccess.status, "refuted");
  assert.equal(resSuccess.verifier.mode, "strong");

  // Scenario 2: Retry i dalje vraća weak refute -> status ostaje 'moderate'
  const agentStillWeak = createFakeAgent([
    {
      text: JSON.stringify({
        verdicts: [{ findingId: "F-001", verdict: "refute", mode: "weak", reason: "Weak reasoning on pass 1" }]
      })
    },
    {
      text: JSON.stringify({
        verdicts: [{ findingId: "F-001", verdict: "refute", mode: "weak", reason: "Weak reasoning on retry too" }]
      })
    }
  ]);

  const resModerate = await verifyOne({
    finding,
    repo,
    agent: agentStillWeak,
    excerpts: "   1 | const val = input.val;\n   2 | if (val == null) return fallback;",
    maxTokens: 2000
  });

  assert.equal(agentStillWeak.calls.length, 2);
  assert.equal(resModerate.status, "moderate");
});

test("strict L1 requires every citation and exact declared snippet length", async function (t) {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);
  writeFileSync(join(dir, "target.js"), "const one = 1;\nconst two = 2;\nconst three = 3;\n");
  const repo = { root: dir, manifest: new Map([["target.js", {}]]) };
  const first = { path: "target.js", startLine: 1, endLine: 1, snippet: "const one = 1;" };
  const bad = { path: "target.js", startLine: 2, endLine: 2, snippet: "const two = 9;" };
  const agent = createFakeAgent([]);
  const result = await verifyOne({ finding: { id: "F-001", evidence: [first, bad] }, repo, agent, excerpts: "" });
  assert.equal(result.status, "l1-rejected");
  assert.match(result.l1.reason, /does not match/);
  assert.equal(agent.calls.length, 0);
  const short = checkCitation({ path: "target.js", startLine: 1, endLine: 2, snippet: "const one = 1;" }, repo);
  assert.equal(short.passed, false);
  assert.match(short.reason, /expects 2 lines but snippet has 1 lines/);
  const long = checkCitation({ path: "target.js", startLine: 1, endLine: 1, snippet: "const one = 1;\nconst two = 2;" }, repo);
  assert.equal(long.passed, false);
  assert.match(long.reason, /expects 1 lines but snippet has 2 lines/);
  const exact = checkCitation({ path: "target.js", startLine: 1, endLine: 2, snippet: "\nconst one = 1;\nconst two = 2;\n" }, repo);
  assert.equal(exact.passed, true);
});

test("retry can remain weak or uncertain but cannot confirm", async function (t) {
  const { dir, cleanup } = createTempRepo();
  t.after(cleanup);
  writeFileSync(join(dir, "target.js"), "const value = input;\nreturn value;\n");
  const repo = { root: dir, manifest: new Map([["target.js", {}]]) };
  const finding = { id: "F-001", evidence: [{ path: "target.js", startLine: 1, endLine: 1, snippet: "const value = input;" }] };
  const first = { verdicts: [{ findingId: "F-001", verdict: "refute", mode: "weak", reason: "The reasoning is insufficient." }] };
  const cases = [
    { verdicts: [{ findingId: "F-001", verdict: "refute", mode: "weak", reason: "Still a weak reason here." }] },
    { verdicts: [{ findingId: "F-001", verdict: "uncertain", reason: "The context is insufficient." }] },
    { verdicts: [{ findingId: "F-001", verdict: "refute", mode: "strong", reason: "The offered line is invalid.", counterEvidence: [{ path: "target.js", startLine: 2, endLine: 2, snippet: "return other;" }] }] },
    { verdicts: [{ findingId: "F-001", verdict: "confirm", reason: "A retry must not confirm." }] }
  ];
  for (const retry of cases) {
    const agent = createFakeAgent([first, retry]);
    const result = await verifyOne({ finding, repo, agent, excerpts: "   1 | const value = input;\n   2 | return value;" });
    assert.equal(result.status, "moderate");
    assert.equal(agent.calls.length, 2);
  }
  const schemaItem = STRONG_REFUTE_RESPONSE_FORMAT.json_schema.schema.properties.verdicts.items;
  assert.deepEqual(schemaItem.properties.verdict.enum, ["refute", "uncertain"]);
  assert.deepEqual(schemaItem.properties.mode.enum, ["strong", "weak"]);
  assert.equal(schemaItem.required.includes("counterEvidence"), false);
});

test("verifier receives no scanner severity or confidence, and prompt example is absent from fixture", function () {
  const finding = { id: "F-001", title: "Example defect", claim: "A plausible defect claim with enough words.", evidence: [], severity: "critical", confidence: 0.99 };
  const messages = buildVerifierMessages(finding, "example excerpt");
  assert.equal(/severity|confidence/i.test(JSON.stringify(messages)), false);
  const exampleLine = JSON.parse(VERIFIER_SYSTEM_PROMPT.split("\n").find(function (line) { return line.startsWith("Strong refute:"); }).slice("Strong refute: ".length)).verdicts[0].counterEvidence[0].snippet.trim();
  const fixtureLines = ["analytics.ts", "batch.ts", "cache.ts", "ledger.ts", "log.ts", "paging.ts", "quota.ts", "registry.ts", "retry.ts", "scheduler.ts", "scores.ts", "session.ts", "settings.ts", "validation.ts", "index.ts"];
  for (const file of fixtureLines) {
    const contents = readFileSync(new URL("../bench/seed-repo/src/" + file, import.meta.url), "utf8");
    assert.equal(contents.split("\n").some(function (line) { return line.trim() === exampleLine; }), false, file);
  }
});
