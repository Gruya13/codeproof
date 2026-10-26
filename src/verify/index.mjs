import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDirtyJson } from "../run/json.mjs";
import { readFileAtCommit } from "../run/index.mjs";

export const VERIFIER_SYSTEM_PROMPT = [
  "You are an adversarial verifier. A finding was produced by another model.",
  "Your job is to try to refute it. You are not here to be agreeable.",
  "You receive the finding JSON, the cited snippet, and the file excerpts that the scanner saw.",
  "confirm - only if the cited code really does what the claim says and the claim is not overstated.",
  "refute with mode strong - provide counterEvidence: a verbatim snippet from the given files that shows the premise of the claim is false. The system re-checks it mechanically; if it does not match, the verdict is downgraded to weak.",
  "refute with mode weak - refute by reasoning when you cannot cite a precise snippet. This downgrades the finding to moderate confidence, it does not veto it.",
  "uncertain - when the given context cannot settle it. Say what you would need to see.",
  "Never refute because something might be handled elsewhere without citing that elsewhere.",
  "When the verdict is refute, mode is mandatory. For mode strong the counterEvidence array is mandatory and its snippet must be copied verbatim from the provided excerpts, line for line; a strong refute whose citation does not match is downgraded to weak.",
  "Prefer a strong refute whenever a counter-line exists in the excerpts; do not settle for weak reasoning when you can cite the line.",
  "If the claim asserts that some behavior is absent (never / does not / cannot / swallows / ignores) and the excerpts contain the corresponding construct (throw, rethrow, await, return, guard, validation), you must return refute with mode strong and cite that construct as counterEvidence.",
  "The reason field must be at least one sentence and must cite file:line.",
  "Examples (illustrative, not taken from the repository under analysis):",
  "Strong refute: {\"verdicts\":[{\"findingId\":\"F-004\",\"verdict\":\"refute\",\"mode\":\"strong\",\"reason\":\"The value is null-checked before use at src/session.ts:41, so the fallback already handles the missing value.\",\"counterEvidence\":[{\"path\":\"src/session.ts\",\"startLine\":41,\"endLine\":41,\"snippet\":\"  if (value == null) return fallback;\"}]}]}",
  "Weak refute (only when no line in the excerpts contradicts the claim): {\"verdicts\":[{\"findingId\":\"F-007\",\"verdict\":\"refute\",\"mode\":\"weak\",\"reason\":\"The loop is reachable only when size >= 1, which the caller guarantees; the off-by-one cannot trigger.\"}]}",
  "A reason that names a refuting line but omits it from counterEvidence is a weak refute; include the line instead.",
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
              findingId: { type: "string", pattern: "^F-[0-9]{3}$" },
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

export const STRONG_REFUTE_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "codeproof_strong_refute",
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
            required: ["findingId", "verdict", "mode", "reason", "counterEvidence"],
            properties: {
              findingId: { type: "string", pattern: "^F-[0-9]{3}$" },
              verdict: { const: "refute" },
              mode: { const: "strong" },
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
  const committed = repo.commit ? readFileAtCommit(repo.root, repo.commit, file) : null;
  const source = committed === null ? readFileSync(join(repo.root, file), "utf8") : committed;
  const lines = source.split("\n");
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
    if (typeof verdict.reason !== "string" || verdict.reason.length < 10) errors.push("reason is too short");
    if (verdict.verdict === "refute") {
      if (["strong", "weak"].indexOf(verdict.mode) === -1) {
        // refute without a mode is a weak refute by definition: it carries no machine-checked counter-citation
        verdict.mode = "weak";
      } else if (verdict.mode === "strong" && (!Array.isArray(verdict.counterEvidence) || verdict.counterEvidence.length === 0)) {
        // strong refute without a counter-citation is not a reason to drop the finding: degrade to weak
        verdict.mode = "weak";
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
  const maxTokens = input.maxTokens || 4000;
  let call = await input.agent.complete({
    role: "verifier",
    messages: buildVerifierMessages(finding, input.excerpts),
    responseFormat: VERIFIER_RESPONSE_FORMAT,
    temperature: 0,
    maxTokens: maxTokens
  });
  if (String(call.text || "").trim() === "") {
    call = await input.agent.complete({
      role: "verifier",
      messages: buildVerifierMessages(finding, input.excerpts),
      responseFormat: VERIFIER_RESPONSE_FORMAT,
      temperature: 0,
      maxTokens: maxTokens * 2
    });
  }
  let verdict;
  try {
    const parsed = parseDirtyJson(call.text);
    const validated = validateVerdictsL0(parsed);
    if (!validated.ok) {
      console.warn("  WARN verifier output failed L0 for " + finding.id + ": " + validated.errors.join("; "));
      verdict = { findingId: finding.id, verdict: "uncertain", reason: "verifier output failed L0: " + validated.errors.join("; ") };
    } else {
      verdict = validated.verdicts.find(function (item) { return item.findingId === finding.id; });
      if (!verdict) verdict = { findingId: finding.id, verdict: "uncertain", reason: "verifier returned no verdict for this finding" };
    }
  } catch (error) {
    console.warn("  WARN verifier output not parseable for " + finding.id + ": " + error.message + " (finish_reason=" + String(call.finishReason) + ")");
    verdict = { findingId: finding.id, verdict: "uncertain", reason: "verifier output was not parseable JSON (" + error.message + "), finish_reason=" + String(call.finishReason) };
  }
  let outcome = applyVerdict(verdict, call.model, repo);
  if (outcome.status === "moderate" && verdict.verdict === "refute") {
    const retryCall = await input.agent.complete({
      role: "verifier",
      messages: buildStrongRefuteMessages(finding, input.excerpts, call.text),
      responseFormat: STRONG_REFUTE_RESPONSE_FORMAT,
      temperature: 0,
      maxTokens: maxTokens
    });
    try {
      const retryParsed = parseDirtyJson(retryCall.text);
      const retryValidated = validateVerdictsL0(retryParsed);
      if (retryValidated.ok) {
        const retryVerdict = retryValidated.verdicts.find(function (item) { return item.findingId === finding.id; });
        if (retryVerdict && retryVerdict.verdict === "refute" && retryVerdict.mode === "strong") {
          const secondOutcome = applyVerdict(retryVerdict, retryCall.model, repo);
          if (secondOutcome.status === "refuted") outcome = secondOutcome;
        }
      }
    } catch (error) {
      console.warn("  WARN strong-refute retry failed for " + finding.id + ": " + error.message);
    }
  }
  return { finding: finding, status: outcome.status, l1: passing, verifier: outcome.verifier };
}
export function applyVerdict(verdict, model, repo) {
  const verifier = { model: model, verdict: verdict.verdict, reason: verdict.reason };
  let status = "uncertain";
  if (verdict.verdict === "confirm") {
    status = "verified";
  } else if (verdict.verdict === "refute") {
    verifier.mode = verdict.mode;
    const counterEvidence = Array.isArray(verdict.counterEvidence) ? verdict.counterEvidence : [];
    if (counterEvidence.length > 0) verifier.counterEvidence = counterEvidence;
    if (verdict.mode === "strong" && counterEvidence.length === 0) {
      verdict.mode = "weak";
      verifier.mode = "weak";
    }
    if (verdict.mode === "strong") {
      const counterChecks = counterEvidence.map(function (evidence) {
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
  return { status: status, verifier: verifier };
}

export function buildStrongRefuteMessages(finding, excerpts, previousOutput) {
  const base = buildVerifierMessages(finding, excerpts);
  return base.concat([
    { role: "assistant", content: String(previousOutput || "").slice(0, 2000) },
    {
      role: "user",
      content: "You refuted the finding without a counter-citation. The excerpts may contain a line that directly contradicts the claim: a guard, sanitizer, awaited call, throw or rethrow, or a correct branch. If such a line exists, return the verdict again with mode strong and counterEvidence copied verbatim from the excerpts (path, startLine, endLine, snippet). If no such line exists, return mode weak again and say why."
    }
  ]);
}