import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDirtyJson } from "../run/json.mjs";

export const VERIFIER_SYSTEM_PROMPT = [
  "You are an adversarial verifier. A finding was produced by another model.",
  "Your job is to try to refute it. You are not here to be agreeable.",
  "You receive the finding JSON, the cited snippet, and the file excerpts that the scanner saw.",
  "confirm - only if the cited code really does what the claim says and the claim is not overstated.",
  "refute with mode strong - provide counterEvidence: a verbatim snippet from the given files that shows the premise of the claim is false. The system re-checks it mechanically; if it does not match, the verdict is downgraded to weak.",
  "refute with mode weak - refute by reasoning when you cannot cite a precise snippet. This downgrades the finding to moderate confidence, it does not veto it.",
  "uncertain - when the given context cannot settle it. Say what you would need to see.",
  "Never refute because something might be handled elsewhere without citing that elsewhere.",
  "Do not rewrite the finding and do not invent new findings. Output only JSON matching the verdict schema."
].join("\n");

export const VERIFIER_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "codeproof_verdicts",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["verdicts"],
      properties: {
        verdicts: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["findingId", "verdict", "reason"],
            properties: {
              findingId: { type: "string" },
              verdict: { enum: ["confirm", "refute", "uncertain"] },
              mode: { enum: ["strong", "weak"] },
              reason: { type: "string" },
              counterEvidence: {
                type: "array",
                minItems: 1,
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["path", "startLine", "endLine", "snippet"],
                  properties: {
                    path: { type: "string" },
                    startLine: { type: "integer", minimum: 1 },
                    endLine: { type: "integer", minimum: 1 },
                    snippet: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

export function normalizeLine(line) {
  return String(line).replace(/\r$/, "").replace(/\s+/g, " ").trim();
}

export function checkCitation(evidence, repo) {
  if (!evidence || typeof evidence !== "object") return { passed: false, reason: "evidence is not an object" };
  const file = String(evidence.path || "");
  if (file === "" || file.startsWith("/") || file.split("/").indexOf("..") !== -1) {
    return { passed: false, reason: "path must be relative and must not contain .." };
  }
  if (!repo.manifest.has(file)) return { passed: false, reason: "path is not in the repo manifest: " + file };
  const startLine = evidence.startLine;
  const endLine = evidence.endLine;
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
    return { passed: false, reason: "startLine and endLine must be integers" };
  }
  if (startLine < 1 || endLine < startLine) return { passed: false, reason: "invalid line range" };
  if (endLine - startLine + 1 > 15) return { passed: false, reason: "citation wider than 15 lines" };
  const lines = readFileSync(join(repo.root, file), "utf8").split("\n");
  if (endLine > lines.length) return { passed: false, reason: "line range exceeds file length" };
  const rawSnippet = String(evidence.snippet || "").split("\n");
  while (rawSnippet.length > 0 && rawSnippet[0].trim() === "") rawSnippet.shift();
  while (rawSnippet.length > 0 && rawSnippet[rawSnippet.length - 1].trim() === "") rawSnippet.pop();
  if (rawSnippet.length === 0) return { passed: false, reason: "snippet is empty" };
  const snippetLines = rawSnippet.map(normalizeLine);
  const fileLines = lines.map(normalizeLine);
  for (const offset of [0, -1, 1]) {
    const startIndex = startLine - 1 + offset;
    if (startIndex < 0) continue;
    if (startIndex + snippetLines.length > fileLines.length) continue;
    let matches = true;
    for (let i = 0; i < snippetLines.length; i += 1) {
      if (fileLines[startIndex + i] !== snippetLines[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return {
        passed: true,
        reason: "citation matches lines " + (startIndex + 1) + "-" + (startIndex + snippetLines.length) + " (+/-1 line tolerance)",
        lineTolerance: Math.abs(offset)
      };
    }
  }
  return { passed: false, reason: "snippet does not match the cited lines (tolerance +/-1 line)" };
}

export function validateVerdictsL0(parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.verdicts)) {
    return { ok: false, verdicts: [], errors: ["response is not an object with a verdicts array"] };
  }
  const verdicts = [];
  for (const verdict of parsed.verdicts) {
    if (!verdict || typeof verdict !== "object") {
      errors.push("verdict is not an object");
      continue;
    }
    if (!/^F-[0-9]{3}$/.test(String(verdict.findingId || ""))) errors.push("invalid findingId");
    if (["confirm", "refute", "uncertain"].indexOf(verdict.verdict) === -1) {
      errors.push("invalid verdict value: " + String(verdict.verdict));
      continue;
    }
    if (typeof verdict.reason !== "string" || verdict.reason.length < 20) errors.push("reason is too short");
    if (verdict.verdict === "refute") {
      if (["strong", "weak"].indexOf(verdict.mode) === -1) errors.push("refute requires mode strong or weak");
      if (verdict.mode === "strong" && (!Array.isArray(verdict.counterEvidence) || verdict.counterEvidence.length === 0)) {
        errors.push("strong refute requires counterEvidence");
      }
    } else if (Array.isArray(verdict.counterEvidence) && verdict.counterEvidence.length > 0) {
      errors.push("counterEvidence is only allowed for refute");
    }
    verdicts.push(verdict);
  }
  return { ok: errors.length === 0, verdicts: verdicts, errors: errors };
}

export function buildVerifierMessages(finding, excerpts) {
  const user = [
    "Finding under review:",
    JSON.stringify(finding, null, 2),
    "",
    "Relevant file excerpts:",
    excerpts,
    "",
    "Return the verdicts JSON object now (one verdict for this findingId)."
  ].join("\n");
  return [
    { role: "system", content: VERIFIER_SYSTEM_PROMPT },
    { role: "user", content: user }
  ];
}

export async function verifyOne(input) {
  const finding = input.finding;
  const repo = input.repo;
  const checks = (finding.evidence || []).map(function (evidence) {
    return checkCitation(evidence, repo);
  });
  const passing = checks.find(function (check) { return check.passed; });
  if (!passing) {
    const first = checks[0] || { reason: "finding has no evidence" };
    return { finding: finding, status: "l1-rejected", l1: first, verifier: null };
  }
  const call = await input.agent.complete({
    role: "verifier",
    messages: buildVerifierMessages(finding, input.excerpts),
    responseFormat: VERIFIER_RESPONSE_FORMAT,
    temperature: 0,
    maxTokens: 1500
  });
  let verdict;
  try {
    const parsed = parseDirtyJson(call.text);
    const validated = validateVerdictsL0(parsed);
    if (!validated.ok) {
      verdict = { findingId: finding.id, verdict: "uncertain", reason: "verifier output failed L0: " + validated.errors.join("; ") };
    } else {
      verdict = validated.verdicts.find(function (item) { return item.findingId === finding.id; });
      if (!verdict) verdict = { findingId: finding.id, verdict: "uncertain", reason: "verifier returned no verdict for this finding" };
    }
  } catch (error) {
    verdict = { findingId: finding.id, verdict: "uncertain", reason: "verifier output was not parseable JSON: " + error.message };
  }
  const verifier = { model: call.model, verdict: verdict.verdict, reason: verdict.reason };
  let status = "uncertain";
  if (verdict.verdict === "confirm") {
    status = "verified";
  } else if (verdict.verdict === "refute") {
    verifier.mode = verdict.mode;
    if (Array.isArray(verdict.counterEvidence) && verdict.counterEvidence.length > 0) {
      verifier.counterEvidence = verdict.counterEvidence;
    }
    if (verdict.mode === "strong") {
      const counterChecks = verdict.counterEvidence.map(function (evidence) {
        return checkCitation(evidence, repo);
      });
      const failed = counterChecks.find(function (check) { return !check.passed; });
      verifier.counterEvidenceL1 = {
        passed: !failed,
        reason: failed ? failed.reason : "counter-citation verified against the commit"
      };
      status = failed ? "moderate" : "refuted";
    } else {
      status = "moderate";
    }
  }
  return { finding: finding, status: status, l1: passing, verifier: verifier };
}
