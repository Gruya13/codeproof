// LinkCheck harness (F1.10). Runs INSIDE the analyzed snapshot under the Node permission model:
// --permission --allow-inspector --allow-fs-read=<snapshot> (no fs-write, no net allowed).
// It imports the generated test, takes V8 precise coverage from memory (no file is written), and
// reports which functions of the target file actually executed. A dead or decorative call leaves
// the count at zero, so a passing test that never called the code cannot become execution-proven.
import inspector from "node:inspector";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const testPath = argv[0];
const targetFile = argv[1];
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
  for (const script of coverage) {
    if (!script.url || !script.url.endsWith("/" + targetFile)) continue;
    for (const fn of script.functions || []) {
      if (!fn.functionName) continue;
      const count = fn.ranges && fn.ranges[0] ? fn.ranges[0].count : 0;
      if (count > 0) executed[fn.functionName] = (executed[fn.functionName] || 0) + count;
    }
  }
  const hit = symbols.filter(function (symbol) { return Boolean(executed[symbol]); });
  process.stdout.write(JSON.stringify({
    status: hit.length > 0 ? "proven" : "unproven",
    targetFile: targetFile,
    symbols: symbols,
    executed: executed,
    hit: hit
  }) + "\n");
}

main().catch(function (error) {
  process.stdout.write(JSON.stringify({ status: "error", error: error.message }) + "\n");
});