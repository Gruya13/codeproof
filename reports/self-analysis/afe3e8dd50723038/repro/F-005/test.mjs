import assert from "node:assert/strict";
import { isSnippetInExcerpts } from "./verify/index.mjs";

const snippet = "const answer = 42;";
const excerpts = "10 | const answer = 42;\n11 | return answer;";

// Controls: behavior with real string excerpts.
assert.equal(isSnippetInExcerpts(snippet, excerpts), true);
assert.equal(isSnippetInExcerpts("const missing = 1;", excerpts), false);

// Missing excerpts cannot contain the snippet, so they must be absent.
assert.equal(isSnippetInExcerpts(snippet, undefined), false);
assert.equal(isSnippetInExcerpts(snippet, null), false);
assert.equal(isSnippetInExcerpts(snippet), false);
assert.equal(isSnippetInExcerpts(snippet, 42), false);
assert.equal(isSnippetInExcerpts(snippet, {}), false);
