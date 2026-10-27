import assert from "node:assert/strict";
import { parseHost, parseURL } from "./parse.ts";

let error;
let withPort;
try {
  withPort = parseHost("[::1]:8080");
} catch (e) {
  error = e;
}
assert.equal(error, undefined);
assert.equal(withPort.hostname, "[::1]");
assert.equal(withPort.port, "8080");

let noPort;
try {
  noPort = parseHost("[::1]");
} catch (e) {
  error = e;
}
assert.equal(error, undefined);
assert.equal(noPort.hostname, "[::1]");
assert.equal(noPort.port, undefined);

const full = parseHost("[2001:db8::1]:443");
assert.equal(full.hostname, "[2001:db8::1]");
assert.equal(full.port, "443");

const plain = parseHost("foo.com:8080");
assert.equal(plain.hostname, "foo.com");
assert.equal(plain.port, "8080");

const parsed = parseURL("http://[::1]:8080/foo");
assert.equal(parsed.host, "[::1]:8080");
const fromURL = parseHost(parsed.host);
assert.equal(fromURL.hostname, "[::1]");
assert.equal(fromURL.port, "8080");
