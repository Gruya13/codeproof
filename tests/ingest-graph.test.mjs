import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest } from "../src/ingest/index.mjs";

function withFiles(files, check) {
  const dir = mkdtempSync(join(tmpdir(), "codeproof-graph-"));
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
    check(ingest(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("T-C11: comments, strings, and templates do not create import edges", function () {
  withFiles({
    "main.ts": [
      "// import x from './a'",
      "/* import x from './x' */",
      'const text = "import y from \'./b\'";',
      "const template = `import z from './t'`;"
    ].join("\n"),
    "a.ts": "", "x.ts": "", "b.ts": "", "t.ts": ""
  }, function (repo) {
    assert.deepEqual(repo.edges, []);
    assert.deepEqual(repo.cycles, []);
  });
});

test("T-C12: static, type, side-effect, require, and dynamic imports make exact edges", function () {
  withFiles({
    "main.ts": [
      'import("./x");',
      "export * from './e';",
      "export {x} from './f';",
      "import type {T} from './t';",
      "import value from './a';",
      "import './side';",
      "require('./r');"
    ].join("\n"),
    "x.ts": "", "e.ts": "", "f.ts": "", "t.ts": "", "a.ts": "", "side.ts": "", "r.ts": ""
  }, function (repo) {
    assert.deepEqual(repo.edges, [
      { from: "main.ts", to: "x.ts", specifier: "./x" },
      { from: "main.ts", to: "e.ts", specifier: "./e" },
      { from: "main.ts", to: "f.ts", specifier: "./f" },
      { from: "main.ts", to: "t.ts", specifier: "./t" },
      { from: "main.ts", to: "a.ts", specifier: "./a" },
      { from: "main.ts", to: "side.ts", specifier: "./side" },
      { from: "main.ts", to: "r.ts", specifier: "./r" }
    ]);
  });
});

test("T-C13: JS extensions resolve to TS and only real cycles are reported", function () {
  withFiles({
    "main.ts": "import './x.js';\nimport './view.jsx';\n",
    "x.ts": "", "view.tsx": "",
    "a.ts": "import './b';\n",
    "b.ts": "import './a';\n",
    "loose-a.ts": "// import './loose-b';\n",
    "loose-b.ts": "import './loose-a';\n"
  }, function (repo) {
    assert.deepEqual(repo.edges, [
      { from: "a.ts", to: "b.ts", specifier: "./b" },
      { from: "b.ts", to: "a.ts", specifier: "./a" },
      { from: "loose-b.ts", to: "loose-a.ts", specifier: "./loose-a" },
      { from: "main.ts", to: "x.ts", specifier: "./x.js" },
      { from: "main.ts", to: "view.tsx", specifier: "./view.jsx" }
    ]);
    assert.deepEqual(repo.cycles, [["a.ts", "b.ts", "a.ts"]]);
  });
});
