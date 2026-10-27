"use strict";
// F-003 hand-check probe: does socket._meta / the timeout listener survive a completed
// keep-alive response when setupResponseListeners is skipped (no logger, no onResponse,
// no handlerTimeout)?
const Fastify = require(process.env.FASTIFY_ROOT + "/fastify.js");
const http = require("node:http");

async function runCase(withLogger) {
  const app = Fastify({ logger: withLogger ? { level: "silent" } : false });
  let captured = null;
  app.get("/t", { onTimeout: function () {} }, async function (request) {
    captured = request.raw.socket;
    return { ok: true };
  });
  app.get("/plain", async function () { return { ok: true }; });
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = app.server.address().port;
  const get = (path) => new Promise((resolve, reject) => {
    const req = http.get({ port, host: "127.0.0.1", path, agent }, (res) => { res.resume(); res.on("end", resolve); });
    req.on("error", reject);
  });
  await get("/t");
  const afterFirst = { socketMetaPresent: !!(captured && captured._meta), timeoutListeners: captured ? captured.listenerCount("timeout") : -1 };
  await get("/plain");
  const afterPlain = { socketMetaPresent: !!(captured && captured._meta), timeoutListeners: captured ? captured.listenerCount("timeout") : -1 };
  await app.close();
  agent.destroy();
  return { withLogger, afterFirst, afterPlain };
}

(async () => {
  console.log(JSON.stringify({ withoutLogger: await runCase(false), withLogger: await runCase(true) }, null, 1));
  process.exit(0);
})().catch((e) => { console.error("PROBE ERROR", e); process.exit(1); });
