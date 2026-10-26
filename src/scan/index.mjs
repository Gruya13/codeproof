export function scannerSystemPrompt(maxFindings) {
  const limit = maxFindings === undefined ? 8 : maxFindings;
  return [
    "You are a static correctness auditor for a TypeScript/JavaScript repository.",
    "You receive a repository digest followed by file contents with line numbers.",
    "Report only direct correctness defects: the defective code is physically present in the lines you cite.",
    "Every finding needs evidence: path, startLine, endLine and a verbatim snippet copied from the input. Never paraphrase code in the snippet.",
    "Do not report missing validations, security, style, performance or architecture issues. Do not guess; if unsure, drop the finding.",
    "Audit resource handles: when a function stores a timer, interval, listener or subscription in a field or module variable, check whether an existing handle is cleared before it is replaced or in cleanup. A handle that is replaced and never cleared is a direct defect.",
    "Audit repeated-call state: module-level or class-level accumulators that are never reset make a second call double-count; report that as a direct defect, not as a missing feature.",
    "Return at most " + limit + " findings sorted by severity. Keep each citation at most 15 lines wide.",
    "Output only a JSON object matching the provided schema. If you find nothing, return an empty findings array."
  ].join("\n");
}

export function buildScannerResponseFormat(maxFindings) {
  const limit = maxFindings === undefined ? 8 : maxFindings;
  return {
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
            maxItems: limit,
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
}

export function buildScannerMessages(input) {
  const maxFindings = input.maxFindings === undefined ? 8 : input.maxFindings;
  const user = input.digest + "\n\n" + input.filesWithLineNumbers + "\n\nReturn the findings JSON object now.";
  return [
    { role: "system", content: scannerSystemPrompt(maxFindings) },
    { role: "user", content: user }
  ];
}

export function validateFindingsL0(parsed) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.findings)) {
    return { ok: false, findings: [], acceptedIndices: [], rejected: [], errors: ["response is not an object with a findings array"] };
  }
  const findings = [];
  const acceptedIndices = [];
  const rejected = [];
  const seenIds = new Set();
  parsed.findings.forEach(function (finding, index) {
    const label = "findings[" + index + "]";
    const reasons = [];
    if (!finding || typeof finding !== "object") {
      rejected.push({ index: index, reasons: [label + " is not an object"] });
      return;
    }
    if (!/^F-[0-9]{3}$/.test(String(finding.id || ""))) reasons.push(label + ".id must match F-NNN");
    if (seenIds.has(finding.id)) reasons.push(label + ".id is duplicate: " + finding.id);
    if (finding.category !== "correctness") reasons.push(label + ".category must be correctness");
    if (finding.kind !== "direct") reasons.push(label + ".kind must be direct");
    if (["critical", "high", "medium", "low"].indexOf(finding.severity) === -1) reasons.push(label + ".severity is invalid");
    if (typeof finding.title !== "string" || finding.title.length < 8) reasons.push(label + ".title is too short");
    if (typeof finding.claim !== "string" || finding.claim.length < 20) reasons.push(label + ".claim is too short");
    if (typeof finding.confidence !== "number" || !Number.isFinite(finding.confidence) || finding.confidence < 0 || finding.confidence > 1) reasons.push(label + ".confidence must be 0..1");
    if (!Array.isArray(finding.evidence) || finding.evidence.length === 0 || finding.evidence.length > 3) {
      reasons.push(label + ".evidence must have 1-3 items");
    } else {
      finding.evidence.forEach(function (evidence, evidenceIndex) {
        const evidenceLabel = label + ".evidence[" + evidenceIndex + "]";
        if (!evidence || typeof evidence !== "object") {
          reasons.push(evidenceLabel + " is not an object");
          return;
        }
        if (typeof evidence.path !== "string" || evidence.path.length === 0) reasons.push(evidenceLabel + ".path is empty");
        if (!Number.isInteger(evidence.startLine) || evidence.startLine < 1) reasons.push(evidenceLabel + ".startLine is invalid");
        if (!Number.isInteger(evidence.endLine) || evidence.endLine < 1) reasons.push(evidenceLabel + ".endLine is invalid");
        if (typeof evidence.snippet !== "string" || evidence.snippet.length === 0) reasons.push(evidenceLabel + ".snippet is empty");
      });
    }
    if (reasons.length > 0) {
      const item = { index: index, reasons: reasons };
      if (typeof finding.id === "string") item.id = finding.id;
      rejected.push(item);
    } else {
      findings.push(finding);
      acceptedIndices.push(index);
      seenIds.add(finding.id);
    }
  });
  return { ok: true, findings: findings, acceptedIndices: acceptedIndices, rejected: rejected, errors: [] };
}
