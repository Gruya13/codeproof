export const SCANNER_SYSTEM_PROMPT = [
  "You are a static correctness auditor for a TypeScript/JavaScript repository.",
  "You receive a repository digest followed by file contents with line numbers.",
  "Report only direct correctness defects: the defective code is physically present in the lines you cite.",
  "Every finding needs evidence: path, startLine, endLine and a verbatim snippet copied from the input. Never paraphrase code in the snippet.",
  "Do not report missing validations, security, style, performance or architecture issues. Do not guess; if unsure, drop the finding.",
  "Return at most 8 findings sorted by severity. Keep each citation at most 15 lines wide.",
  "Output only a JSON object matching the provided schema. If you find nothing, return an empty findings array."
].join("\n");

export const SCANNER_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "codeproof_findings",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["findings"],
      properties: {
        findings: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "category", "kind", "severity", "title", "claim", "evidence", "confidence"],
            properties: {
              id: { type: "string", pattern: "^F-[0-9]{3}$" },
              category: { const: "correctness" },
              kind: { const: "direct" },
              severity: { enum: ["critical", "high", "medium", "low"] },
              title: { type: "string" },
              claim: { type: "string" },
              evidence: {
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
              },
              confidence: { type: "number", minimum: 0, maximum: 1 }
            }
          }
        }
      }
    }
  }
};

export function buildScannerMessages(input) {
  const user = input.digest + "\n\n" + input.filesWithLineNumbers + "\n\nReturn the findings JSON object now.";
  return [
    { role: "system", content: SCANNER_SYSTEM_PROMPT },
    { role: "user", content: user }
  ];
}

export function validateFindingsL0(parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.findings)) {
    return { ok: false, findings: [], errors: ["response is not an object with a findings array"] };
  }
  const findings = [];
  parsed.findings.forEach(function (finding, index) {
    const label = "findings[" + index + "]";
    if (!finding || typeof finding !== "object") {
      errors.push(label + " is not an object");
      return;
    }
    if (!/^F-[0-9]{3}$/.test(String(finding.id || ""))) errors.push(label + ".id must match F-NNN");
    if (finding.category !== "correctness") errors.push(label + ".category must be correctness");
    if (finding.kind !== "direct") errors.push(label + ".kind must be direct");
    if (["critical", "high", "medium", "low"].indexOf(finding.severity) === -1) errors.push(label + ".severity is invalid");
    if (typeof finding.title !== "string" || finding.title.length < 8) errors.push(label + ".title is too short");
    if (typeof finding.claim !== "string" || finding.claim.length < 20) errors.push(label + ".claim is too short");
    if (typeof finding.confidence !== "number" || finding.confidence < 0 || finding.confidence > 1) errors.push(label + ".confidence must be 0..1");
    if (!Array.isArray(finding.evidence) || finding.evidence.length === 0 || finding.evidence.length > 3) {
      errors.push(label + ".evidence must have 1-3 items");
    } else {
      finding.evidence.forEach(function (evidence, evidenceIndex) {
        const evidenceLabel = label + ".evidence[" + evidenceIndex + "]";
        if (!evidence || typeof evidence !== "object") {
          errors.push(evidenceLabel + " is not an object");
          return;
        }
        if (typeof evidence.path !== "string" || evidence.path.length === 0) errors.push(evidenceLabel + ".path is empty");
        if (!Number.isInteger(evidence.startLine) || evidence.startLine < 1) errors.push(evidenceLabel + ".startLine is invalid");
        if (!Number.isInteger(evidence.endLine) || evidence.endLine < 1) errors.push(evidenceLabel + ".endLine is invalid");
        if (typeof evidence.snippet !== "string" || evidence.snippet.length === 0) errors.push(evidenceLabel + ".snippet is empty");
      });
    }
    findings.push(finding);
  });
  return { ok: errors.length === 0, findings: findings, errors: errors };
}
