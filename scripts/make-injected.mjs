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
  },
  // Extended set (INJ-07..INJ-16): subtle defects in the real axios core and helpers.
  {
    id: "INJ-07",
    file: "lib/helpers/parseHeaders.js",
    find: "      key = line.substring(0, i).trim().toLowerCase();",
    replace: "      key = line.substring(0, i).trim();",
    marker: "key = line.substring(0, i).trim();",
    statement: "header names are no longer lower-cased during parsing, so Content-Type and content-type become distinct keys and a lookup by the canonical lower-case name returns undefined."
  },
  {
    id: "INJ-08",
    file: "lib/core/settle.js",
    find: "  if (!response.status || !validateStatus || validateStatus(response.status)) {",
    replace: "  if (!response.status || !validateStatus || validateStatus(response.status) || response.status < 500) {",
    marker: "validateStatus(response.status) || response.status < 500",
    statement: "a response status below 500 is resolved before validateStatus decides, so 4xx client errors are delivered as successful responses and the caller's rejection handler never runs."
  },
  {
    id: "INJ-09",
    file: "lib/helpers/isAxiosError.js",
    find: "  return utils.isObject(payload) && payload.isAxiosError === true;",
    replace: "  return utils.isObject(payload) && payload.isAxiosError !== false;",
    marker: "payload.isAxiosError !== false",
    statement: "any object that does not explicitly set isAxiosError to false is classified as an AxiosError, so errors from other libraries are reported as axios errors with undefined response and config."
  },
  {
    id: "INJ-10",
    file: "lib/helpers/throttle.js",
    find: "        timer = setTimeout(() => {\n          timer = null;\n          invoke(lastArgs);\n        }, threshold - passed);",
    replace: "        timer = setTimeout(() => {\n          timer = null;\n          invoke(args);\n        }, threshold - passed);",
    marker: "          invoke(args);",
    statement: "the trailing invocation uses the arguments of the call that scheduled the timer instead of the most recent call, so the latest payload is dropped when calls are throttled."
  },
  {
    id: "INJ-11",
    file: "lib/cancel/CancelToken.js",
    find: "      if (token.reason) {\n        // Cancellation has already been requested\n        return;\n      }",
    replace: "      if (!token.reason) {\n        // Cancellation has already been requested\n        return;\n      }",
    marker: "      if (!token.reason) {",
    statement: "the cancellation request returns early while no reason exists yet, so the first cancel() call is silently ignored and the request is never cancelled."
  },
  {
    id: "INJ-12",
    file: "lib/helpers/spread.js",
    find: "    return callback.apply(null, arr);",
    replace: "    return callback.apply(null, [arr]);",
    marker: "callback.apply(null, [arr]);",
    statement: "spread passes the whole array as a single argument instead of expanding it, so a wrapped callback receives one array where the original call passed N positional arguments."
  },
  {
    id: "INJ-13",
    file: "lib/helpers/buildURL.js",
    find: "      : new AxiosURLSearchParams(params, _options).toString(_encode);",
    replace: "      : new AxiosURLSearchParams(params, _options).toString();",
    marker: "      : new AxiosURLSearchParams(params, _options).toString();",
    statement: "buildURL ignores a caller-supplied encode function and always uses the default encoder, so custom parameter encoding passed through options is silently dropped."
  },
  {
    id: "INJ-14",
    file: "lib/helpers/formDataToJSON.js",
    find: "    path.push(match[0] === '[]' ? '' : match[1] || match[0]);",
    replace: "    path.push(match[1] || match[0]);",
    marker: "    path.push(match[1] || match[0]);",
    statement: "a FormData field name ending in [] is stored under the literal key [] instead of pushing onto an array, so repeated array fields collapse into one literal property."
  },
  {
    id: "INJ-15",
    file: "lib/helpers/cookies.js",
    find: "        const cookies = cookieString.split(';');",
    replace: "        const cookies = cookieString.split('; ');",
    marker: "        const cookies = cookieString.split('; ');",
    statement: "cookies are split on the two-character separator \"; \" only, but browsers may serialize cookie pairs without the space, so a cookie that follows a space-less separator is not found."
  },
  {
    id: "INJ-16",
    file: "lib/core/transformData.js",
    find: "    data = fn.call(config, data, headers.normalize(), response ? response.status : undefined);",
    replace: "    data = fn.call(config, data, headers.normalize());",
    marker: "    data = fn.call(config, data, headers.normalize());",
    statement: "transformData stops passing the response status to response transformers, so a transformer that branches on the status (for example parses JSON only for 2xx) can no longer see it."
  }
];

// Traps: places in the untouched axios code that look suspicious but are correct. Publishing a
// finding on a trap is a false positive, exactly as in the main benchmark.
const TRAPS = [
  {
    id: "TRAP-01",
    file: "lib/core/AxiosError.js",
    marker: "    if (utils.isBuffer(source)) return source;",
    reason: "redactConfig passes buffers through without redaction. That looks like a leak, but it is deliberate: binary payloads cannot carry the string keys being redacted, and copying them would be wasteful. It is a redaction guard, not a defect."
  },
  {
    id: "TRAP-02",
    file: "lib/core/AxiosHeaders.js",
    marker: "        (_rewrite === undefined && self[key] !== false)",
    reason: "The rewrite guard looks inverted, but it implements the documented AxiosHeaders.set contract: rewrite=true always overwrites, rewrite=false never overwrites an existing non-false value, and undefined only overwrites when the current value is not the literal false."
  },
  {
    id: "TRAP-03",
    file: "lib/helpers/throttle.js",
    marker: "  let threshold = 1000 / freq;",
    reason: "Dividing by freq looks unsafe, but the throttled wrapper is only constructed with a validated positive frequency and the caller owns that contract. There is no zero-division path from this module."
  },
  {
    id: "TRAP-04",
    file: "lib/helpers/parseHeaders.js",
    marker: "ignoreDuplicateOf, key",
    reason: "Dropping duplicate headers from a fixed list is required by the HTTP spec (node ignores duplicates of these fields), not a bug. Headers outside the list are concatenated with ', '."
  },
  {
    id: "TRAP-05",
    file: "lib/cancel/CancelToken.js",
    marker: "      while (i-- > 0) {",
    reason: "Reverse iteration looks risky, but it is deliberate: listeners may unsubscribe themselves while the list is being notified, and iterating backwards keeps the remaining indexes valid."
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
    repo: "axios/axios",
    expectedPath: null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const take = function () { i += 1; return argv[i]; };
    if (arg === "--source") options.source = take();
    else if (arg === "--out") options.out = take();
    else if (arg === "--repo") options.repo = take();
    else if (arg === "--expected") options.expectedPath = take();
    else if (arg === "--help" || arg === "-h") { console.log("usage: node scripts/make-injected.mjs [--source <clone>] [--out <dir>] [--repo <name>] [--expected <expected.json>]"); process.exit(0); }
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
      file: patch.file.replace(/^lib\//, ""),
      startLine: location.startLine,
      endLine: location.endLine,
      statement: patch.statement
    });
  }

  const traps = [];
  for (const trap of TRAPS) {
    const trapSource = readFileSync(join(clone, trap.file), "utf8");
    const location = lineOf(trapSource, trap.marker);
    if (!location) throw new Error(trap.id + ": marker not found in " + trap.file);
    traps.push({ id: trap.id, file: trap.file.replace(/^lib\//, ""), startLine: location.startLine, endLine: location.endLine, reason: trap.reason });
  }

  run("git", ["-c", "user.name=codeproof-probe", "-c", "user.email=probe@example.invalid", "add", "-A"], clone);
  run("git", ["-c", "user.name=codeproof-probe", "-c", "user.email=probe@example.invalid", "commit", "-q", "-m", "probe: inject " + defects.length + " known correctness defects"], clone);
  const commit = run("git", ["rev-parse", "HEAD"], clone).trim();
  const expected = {
    tool: "make-injected",
    createdAt: new Date().toISOString(),
    repo: options.repo,
    sourceClone: source,
    baseCommit: baseCommit,
    commit: commit,
    scope: "lib",
    pathNote: "paths are relative to the analyzed scope (lib/)",
    toleranceLines: 2,
    defects: defects,
    traps: traps,
    extraTrue: []
  };
  const expectedPath = options.expectedPath ? resolve(options.expectedPath) : join(out, "expected.json");
  mkdirSync(join(expectedPath, ".."), { recursive: true });
  writeFileSync(expectedPath, JSON.stringify(expected, null, 2) + "\n");
  console.log("Injected repo written to " + clone);
  console.log("  base commit " + baseCommit);
  console.log("  injected commit " + commit);
  for (const defect of defects) {
    console.log("  " + defect.id + "  " + defect.file + ":" + defect.startLine + "-" + defect.endLine);
  }
  console.log("  expected  " + expectedPath);
}

main();
