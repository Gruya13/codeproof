// LinkCheck harness (F1.10). Runs INSIDE the analyzed snapshot under the Node permission model:
// --permission --allow-inspector --allow-fs-read=<snapshot> (no fs-write, no net allowed).
// It imports the generated test, takes V8 precise coverage from memory (no file is written), and
// reports which functions of the target file actually executed. A dead or decorative call leaves
// the count at zero, so a passing test that never called the code cannot become execution-proven.
import inspector from "node:inspector";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const testPath = argv[0];
// targets[0] is the CITED file; the rest are the test's repository imports. A barrel/re-export
// means the file that actually executes is not the file the test imports.
let targets = [];
try { targets = JSON.parse(argv[1]); } catch (error) { targets = [argv[1]]; }
if (!Array.isArray(targets)) targets = [String(targets)];
targets = targets.map(function (target) { return String(target == null ? "" : target).replace(/^\.\//, ""); }).filter(function (target) { return target !== ""; });
const symbols = argv.slice(2);

const session = new inspector.Session();
session.connect();

function post(method, params) {
  return new Promise(function (resolve, reject) {
    session.post(method, params || {}, function (error, result) {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

async function main() {
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  try {
    await import(pathToFileURL(testPath).href);
  } catch (error) {
    // The trigger is expected to fail; the coverage taken below is still what matters.
  }
  const taken = await post("Profiler.takePreciseCoverage");
  const coverage = taken.result || [];
  const executed = {};
  const fileExecuted = {};
  for (const script of coverage) {
    if (!script.url) continue;
    const matched = targets.find(function (target) { return script.url.endsWith("/" + target); });
    if (!matched) continue;
    for (const fn of script.functions || []) {
      const count = fn.ranges && fn.ranges[0] ? fn.ranges[0].count : 0;
      if (count <= 0) continue;
      // The module's own top-level wrapper always executes; it must not count as evidence that
      // repository code was called. Anonymous default exports have an empty name but a non-zero
      // start offset, so they are still counted at file granularity.
      const topLevel = !fn.functionName && fn.ranges && fn.ranges[0] && fn.ranges[0].startOffset === 0;
      if (topLevel) continue;
      fileExecuted[matched] = (fileExecuted[matched] || 0) + count;
      if (!fn.functionName) continue;
      executed[fn.functionName] = (executed[fn.functionName] || 0) + count;
    }
  }
  const hit = symbols.filter(function (symbol) { return Boolean(executed[symbol]); });
  // A barrel re-export or an anonymous/default export may execute the cited module without the
  // imported binding name appearing in coverage. If the cited file executed, the linkage is proven
  // at file granularity; the method is recorded so the report stays precise about which one applied.
  const primary = targets[0] || null;
  const primaryExecuted = Boolean(primary && fileExecuted[primary]);
  const status = hit.length > 0 ? "proven" : (primaryExecuted ? "proven" : "unproven");
  const method = hit.length > 0 ? "symbol" : (primaryExecuted ? "file" : null);
  process.stdout.write(JSON.stringify({
    status: status,
    targetFile: primary,
    targetFiles: targets,
    method: method,
    symbols: symbols,
    executed: executed,
    fileExecuted: fileExecuted,
    hit: hit
  }) + "\n");
}

main().catch(function (error) {
  process.stdout.write(JSON.stringify({ status: "error", error: error.message }) + "\n");
});