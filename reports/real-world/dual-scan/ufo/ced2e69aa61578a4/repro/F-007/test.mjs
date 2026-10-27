import assert from "node:assert/strict";
import { parseURL, stringifyParsedURL } from "./parse.ts";

assert.equal(
  stringifyParsedURL(parseURL("data:text/plain,hello")),
  "data:text/plain,hello",
);
assert.equal(
  stringifyParsedURL(parseURL("blob:https://example.com/id")),
  "blob:https://example.com/id",
);
assert.equal(
  stringifyParsedURL(parseURL("javascript:alert(1)")),
  "javascript:alert(1)",
);
assert.equal(
  stringifyParsedURL(parseURL("http://foo.com/foo?test=123#token")),
  "http://foo.com/foo?test=123#token",
);
