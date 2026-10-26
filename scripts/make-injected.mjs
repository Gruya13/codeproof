#!/usr/bin/env node
// Build an injected variant of a real repository: copy a pinned clone, add a
// small set of known correctness defects, commit the result, and write the
// ground truth (file + lines + statement) for scoring.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const PATCHES = [
  {
    id: "INJ-01",
    file: "lib/helpers/isAbsoluteURL.js",
    find: "  if (typeof url !== 'string') {\n    return false;\n  }",
    replace: "  if (typeof url !== 'string') {\n    return true;\n  }",
    marker: "    return true;\n  }\n\n  return /^([a-z][a-z\\d+\\-.]*:)?\\/\\//i.test(url);",
    statement: "isAbsoluteURL treats any non-string input as an absolute URL: a missing or non-string url bypasses the scheme check and is returned as absolute instead of false."
  },
  {
    id: "INJ-02",
    file: "lib/helpers/combineURLs.js",
    find: "  return baseURL.slice(0, end) + '/' + relativeURL.replace(/^\\/+/, '');",
    replace: "  return baseURL.slice(0, end) + relativeURL.replace(/^\\/+/, '');",
    marker: "  return baseURL.slice(0, end) + relativeURL.replace(/^\\/+/, '');",
    statement: "combineURLs concatenates the base and the relative URL without the separator, so a relative path is glued to the last path segment of the base URL."
  },
  {
    id: "INJ-03",
    file: "lib/helpers/buildURL.js",
    find: "      url = url.slice(0, hashmarkIndex);",
    replace: "      url = url.slice(0, hashmarkIndex + 1);",
    marker: "      url = url.slice(0, hashmarkIndex + 1);",
    statement: "buildURL keeps the hash mark when stripping the fragment, so serialized params are appended after the fragment and never reach the server."
  },
  {
    id: "INJ-04",
    file: "lib/core/InterceptorManager.js",
    find: "      utils.forEach(this.handlers, function forEachHandler(h) {\n        if (h !== null) {\n          fn(h);\n        }\n      });",
    replace: "      utils.forEach(this.handlers, function forEachHandler(h) {\n        fn(h);\n      });",
    marker: "      utils.forEach(this.handlers, function forEachHandler(h) {\n        fn(h);\n      });",
    statement: "InterceptorManager.forEach no longer skips null slots, so it calls the iteration callback with null for every ejected interceptor."
  },
  // new files: defect is inside the file from the start
  {
    id: "INJ-05",
    file: "lib/helpers/scheduler.js",
    create: [
      "'use strict';",
      "",
      "export function createScheduler() {",
      "  return {",
      "    timer: null,",
      "    start(callback, intervalMs) {",
      "      this.timer = setInterval(callback, intervalMs);",
      "    },",
      "    stop() {",
      "      clearInterval(this.timer);",
      "      this.timer = null;",
      "    }",
      "  };",
      "}",
      ""
    ].join("\n"),
    marker: "      this.timer = setInterval(callback, intervalMs);",
    statement: "start() assigns a new interval without clearing the existing timer, so calling start() twice leaks the first interval and it keeps firing."
  },
  {
    id: "INJ-06",
    file: "lib/helpers/session.js",
    create: [
      "'use strict';",
      "",
      "export async function rotateAndRead(store) {",
      "  store.save({ token: 'next' });",
      "  return store.get('token');",
      "}",
      ""
    ].join("\n"),
    marker: "  store.save({ token: 'next' });",
    statement: "store.save is not awaited before store.get, so the read can return the previous token instead of the value that was just saved."
  }
];

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd: cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function lineOf(source, needle) {
  const index = source.indexOf(needle);
  if (index === -1) return null;
  const before = source.slice(0, index);
  const startLine = before.split("\n").length;
  const lineCount = needle.split("\n").length;
  return { startLine: startLine, endLine: startLine + lineCount - 1 };
}

function parseArgs(argv) {
  const options = {
    source: "reports/probes/real/axios-lib/_repo",
    out: "reports/probes/real/axios-injected",
    repo: "axios/axios"
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const take = function () { i += 1; return argv[i]; };
    if (arg === "--source") options.source = take();
    else if (arg === "--out") options.out = take();
    else if (arg === "--repo") options.repo = take();
    else if (arg === "--help" || arg === "-h") { console.log("usage: node scripts/make-injected.mjs [--source <clone>] [--out <dir>] [--repo <name>]"); process.exit(0); }
    else throw new Error("unknown option: " + arg);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = resolve(options.source);
  const out = resolve(options.out);
  if (!existsSync(join(source, ".git"))) throw new Error("source is not a git clone: " + source);
  const clone = join(out, "_repo");
  if (existsSync(clone)) execFileSync("rm", ["-rf", clone]);
  mkdirSync(out, { recursive: true });
  run("git", ["clone", "--no-hardlinks", "-q", source, clone], out);
  const baseCommit = run("git", ["rev-parse", "HEAD"], clone).trim();

  const defects = [];
  for (const patch of PATCHES) {
    const path = join(clone, patch.file);
    let sourceText;
    if (patch.create !== undefined) {
      if (existsSync(path)) throw new Error("new file already exists: " + patch.file);
      writeFileSync(path, patch.create);
      sourceText = patch.create;
    } else {
      sourceText = readFileSync(path, "utf8");
      const count = sourceText.split(patch.find).length - 1;
      if (count !== 1) throw new Error(patch.id + ": expected exactly one match in " + patch.file + ", got " + count);
      sourceText = sourceText.replace(patch.find, patch.replace);
      writeFileSync(path, sourceText);
    }
    const location = lineOf(sourceText, patch.marker);
    if (!location) throw new Error(patch.id + ": marker not found in " + patch.file);
    defects.push({
      id: patch.id,
      file: patch.file,
      startLine: location.startLine,
      endLine: location.endLine,
      statement: patch.statement
    });
  }

  run("git", ["-c", "user.name=codeproof-probe", "-c", "user.email=probe@example.invalid", "add", "-A"], clone);
  run("git", ["-c", "user.name=codeproof-probe", "-c", "user.email=probe@example.invalid", "commit", "-q", "-m", "probe: inject six known correctness defects"], clone);
  const commit = run("git", ["rev-parse", "HEAD"], clone).trim();
  const expected = {
    tool: "make-injected",
    createdAt: new Date().toISOString(),
    repo: options.repo,
    sourceClone: source,
    baseCommit: baseCommit,
    commit: commit,
    scope: "lib",
    toleranceLines: 2,
    defects: defects
  };
  writeFileSync(join(out, "expected.json"), JSON.stringify(expected, null, 2) + "\n");
  console.log("Injected repo written to " + clone);
  console.log("  base commit " + baseCommit);
  console.log("  injected commit " + commit);
  for (const defect of defects) {
    console.log("  " + defect.id + "  " + defect.file + ":" + defect.startLine + "-" + defect.endLine);
  }
  console.log("  expected  " + join(out, "expected.json"));
}

main();
