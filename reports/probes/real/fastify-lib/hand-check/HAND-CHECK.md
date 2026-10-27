# Fastify probe run - hand check (F-002, F-003)

- Repository: [fastify/fastify](https://github.com/fastify/fastify) at commit `5df959f3af698823dd582f1c3661f3e80df0b5da` (2026-10-25, `fastify@6.0.0-alpha.5`)
- Scope: `lib/` - 31 files, 8,351 LOC, 72/72 files in the scanner prompt
- Run: `2bd3069c497fbca0`, mode `smoke`, scanner `muse-spark-1.3`, verifier `muse-wonder-1.0`
- Result: 3 proposed, **3 verified**, 0 refuted/uncertain; measured cost **$0.7588**
- Method: static reading of the pinned commit + functional probes on a copy of the repo in `/tmp` (`cp -a _repo /tmp/ff && npm install --omit=dev`, 47 packages). The analyzed code itself was never executed; the probe only exercises Fastify's runtime to observe the reported retention.

## Verdicts

| Finding | Scanner status | Hand verdict | Severity (hand) | Upstream |
|---|---|---|---|---|
| F-001 content-type-parser.js:170-190 - `ContentTypeParser.remove` does not clear cache | verified | **Confirmed** in the earlier round (see REAL-WORLD-ROUND.md §5): `getParser` returns cached parser after `remove`. | medium | not checked further |
| F-002 four-oh-four.js:44-50 - defaultRoute double-bind loses instance | verified | **Partially confirmed / low impact**: the double bind is real (a `bind` of an already bound function keeps the first `this`), but it only affects the emergency `defaultRoute` fallback ("this likely a fastify bug" path). Normal prefixed 404 handlers are registered as routes (`router.all(prefix/*, routeHandler, context)`) and are NOT affected. The claim "second prefixed instance has no effect" overstates the impact. | low / informational | no matching open issue found (searches: arrange404, defaultRoute bind, kFourOhFourLevelInstance) |
| F-003 route.js:559-568 - socket onTimeout handle replaced without guaranteed cleanup | verified | **Partially confirmed - memory retention, not wrong behavior**: cleanup of `socket._meta` lives inside `setupResponseListeners`, which is gated on `hasLogger || context.onResponse !== null || handlerTimeout > 0`. With `logger: false`, `onResponse: null` and no `handlerTimeout`, after a completed keep-alive response `socket._meta` is still present and the `timeout` listener is still attached (probe: 2 listeners vs 1 with `logger: true`). Residual impact is bounded retention of the last request/reply/context per keep-alive socket until the next onTimeout request overwrites it or the socket closes. The stale timeout handler does **not** invoke the hook after the response: `hookIterator` returns early when `reply.sent === true` (`lib/hooks.js:411`). | low / memory-retention smell | related fixes #6799 (clear `_meta` after response) and #6810 (clear `_meta` on hijack) are already in this commit; they do not cover the gated path |

## Probe evidence (F-003)

`probe-f003-keepalive.cjs` (requires Fastify copy with dependencies installed; `FASTIFY_ROOT` env). Output:

```json
{
 "withoutLogger": {
  "withLogger": false,
  "afterFirst": {
   "socketMetaPresent": true,
   "timeoutListeners": 2
  },
  "afterPlain": {
   "socketMetaPresent": true,
   "timeoutListeners": 2
  }
 },
 "withLogger": {
  "withLogger": true,
  "afterFirst": {
   "socketMetaPresent": false,
   "timeoutListeners": 1
  },
  "afterPlain": {
   "socketMetaPresent": false,
   "timeoutListeners": 1
  }
 }
}

```

Interpretation: without logger the socket keeps `_meta` and two `timeout` listeners after the response (one is Node's internal, one is Fastify's `handleTimeout`); with `logger: true` the cleanup in `setupResponseListeners` runs and only Node's listener remains.

## Caveats

- The upstream repository and commit are public; contamination is possible. This is a qualitative hand check, not a benchmark metric.
- Fastify version is `6.0.0-alpha.5` (pre-release), so behavior may change before stable.
- F-002 was adjudicated statically (the impact is confined to an emergency path that returns a generic 404); no functional reproduction was attempted.
- The probe copy and `node_modules` live in `/tmp` and are not part of the repository.
