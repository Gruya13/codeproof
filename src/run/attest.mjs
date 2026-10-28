import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Attestation for a v2 report directory: a sha256 for every artifact the run produced, plus the
// hash of findings.json. The attestation lives in run.json and deliberately excludes run.json
// itself (a file cannot contain its own hash).
export const ATTESTATION_SCHEMA_VERSION = 2;

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function listArtifacts(dir, options) {
  const skip = new Set((options && options.skip) || ["run.json"]);
  const artifacts = [];
  function walk(current, prefix) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      const rel = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else if (!skip.has(rel)) artifacts.push(rel);
    }
  }
  walk(dir, "");
  return artifacts.sort();
}

export function buildAttestation(dir, options) {
  const skip = new Set((options && options.skip) || ["run.json"]);
  const artifacts = {};
  const paths = [];
  for (const rel of listArtifacts(dir, options)) {
    if (skip.has(rel)) continue;
    artifacts[rel] = sha256Hex(readFileSync(join(dir, rel)));
    paths.push(rel);
  }
  return {
    schemaVersion: ATTESTATION_SCHEMA_VERSION,
    findingsSha256: artifacts["findings.json"] || null,
    artifacts: artifacts
  };
}

// Verify a report directory against an attestation object. Returns the list of problems; an empty
// list means every listed artifact matches and no unlisted artifact is present.
export function verifyAttestation(dir, attestation) {
  const problems = [];
  if (!attestation || attestation.schemaVersion !== ATTESTATION_SCHEMA_VERSION) {
    return ["attestation missing or has an unsupported schemaVersion"];
  }
  const actual = {};
  for (const rel of listArtifacts(dir, { skip: ["run.json"] })) actual[rel] = sha256Hex(readFileSync(join(dir, rel)));
  const declared = attestation.artifacts || {};
  for (const rel of Object.keys(declared)) {
    if (!(rel in actual)) { problems.push("artifact missing on disk: " + rel); continue; }
    if (actual[rel] !== declared[rel]) problems.push("artifact hash mismatch: " + rel);
  }
  for (const rel of Object.keys(actual)) {
    if (!(rel in declared)) problems.push("artifact not covered by the attestation: " + rel);
  }
  if (declared["findings.json"] && attestation.findingsSha256 && declared["findings.json"] !== attestation.findingsSha256) {
    problems.push("findingsSha256 does not match the findings.json entry");
  }
  return problems;
}