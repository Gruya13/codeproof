import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// L4 (v0.2.0): surgical patch generation and the differential proof gate. The full stage is
// implemented in F2; this module starts with the artifact writer and grows in place.

export function writePatchArtifacts(outDir, findingId, patch) {
  if (!outDir || !patch) return null;
  const dir = join(outDir, "patch");
  mkdirSync(dir, { recursive: true });
  const diffPath = join(dir, findingId + ".diff");
  writeFileSync(diffPath, (patch.diff || "") + ((patch.diff || "").endsWith("\n") ? "" : "\n"));
  writeFileSync(join(dir, findingId + ".json"), JSON.stringify({
    status: patch.status,
    rationale: patch.rationale || null,
    warnings: patch.warnings || [],
    searchBlockSha256: patch.searchBlockSha256 || null,
    replaceBlockSha256: patch.replaceBlockSha256 || null,
    model: patch.model || null,
    costUsd: patch.costUsd === undefined ? null : patch.costUsd,
    attempts: patch.attempts || null
  }, null, 2) + "\n");
  return diffPath;
}