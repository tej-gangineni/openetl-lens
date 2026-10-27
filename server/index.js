// OpenETL Lens: a read-only, bounded API over any number of data stores. The browser never talks to a
// database directly and credentials never leave this process. See API_CONTRACT.md.
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { clampInt, bad, HttpError, mapError, shape, mapLimit } from "./util.js";
import { all, mustFind, publicView, validate, withTemp, addUser, removeConnection, restoreDefaults, hiddenCount, handleFor, dropHandle, closeAll, secrets, find } from "./connections.js";
import { TYPES } from "./stores.js";

const port = Number(process.env.PORT) || 4000;
const app = express();
app.use(express.json({ limit: "100kb" }));

// wrap a handler: JSON out, errors mapped to { error } with a safe status
const h = (fn) => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (err) {
    let secs = [];
    try { const c = req.params.id && find(req.params.id); if (c) secs = secrets(c); if (req.body?.config) secs = secs.concat(secrets({ config: req.body.config })); } catch {}
    const { status, error } = mapError(err, secs);
    res.status(status).json({ error });
  }
};

/* ---- connections */
app.get("/api/connections", h(async () => ({ connections: all().map(publicView), hiddenDefaults: hiddenCount() })));

// Bring back the sample connections that were removed.
app.post("/api/connections/restore-defaults", h(async () => ({ restored: restoreDefaults() })));

app.post("/api/connections/test", h(async (req) => {
  const v = validate(req.body);
  const containers = await withTemp(v, (hd) => hd.containers({ counts: false }));
  return { ok: true, containers: containers.length };
}));

app.post("/api/connections", h(async (req) => {
  const v = validate(req.body);
  await withTemp(v, (hd) => hd.containers({ counts: false }));
  return { connection: publicView(addUser(v)) };
}));

app.delete("/api/connections/:id", h(async (req) => {
  removeConnection(req.params.id);
  dropHandle(req.params.id);
  return { ok: true };
}));

/* ---- browsing */
app.get("/api/c/:id/containers", h(async (req) => {
  const c = mustFind(req.params.id);
  return { containers: await handleFor(c).containers({ counts: true }) };
}));

app.get("/api/c/:id/items", h(async (req) => {
  const c = mustFind(req.params.id);
  const container = typeof req.query.container === "string" ? req.query.container : "";
  if (!container || container.length > 200) throw bad("Pass ?container=NAME.");
  const q = typeof req.query.q === "string" ? req.query.q.slice(0, 200) : "";
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  if (req.query.cursor !== undefined && cursor === undefined) throw bad("That cursor is not valid.");
  return handleFor(c).items({ container, q, limit: clampInt(req.query.limit, 1, 200, 100), cursor });
}));

// The whole record behind one row, for the detail drawer. ref comes from the row's hidden __ref.
app.get("/api/c/:id/row", h(async (req) => {
  const c = mustFind(req.params.id);
  const container = typeof req.query.container === "string" ? req.query.container : "";
  const ref = typeof req.query.ref === "string" ? req.query.ref : "";
  if (!container || container.length > 200 || !ref) throw bad("Pass ?container=NAME&ref=REF.");
  const hd = handleFor(c);
  if (!hd.row) throw bad("This connection cannot return a single record.");
  const row = await hd.row({ container, ref });
  if (!row) throw new HttpError(404, "That record no longer exists.");
  return { row };
}));

app.post("/api/c/:id/query", h(async (req) => {
  const c = mustFind(req.params.id);
  if (c.type !== "relata") throw bad("The query console is only available for Relata connections.");
  return handleFor(c).query(req.body?.sql);
}));

/* ---- overview */
const probe = (c) => {
  const base = { id: c.id, name: c.name, kind: TYPES[c.type].kind, url: TYPES[c.type].endpoint(c.config) };
  let timer;
  const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new HttpError(504, "No answer within 4 seconds.")), 4000); });
  return Promise.race([handleFor(c).containers({ counts: true }), limit])
    .then((containers) => ({ ...base, ok: true, containers }))
    .catch((err) => ({ ...base, ok: false, error: mapError(err, secrets(c)).error.slice(0, 200), containers: [] }))
    .finally(() => clearTimeout(timer));
};
app.get("/api/overview", h(async () => ({ sources: await Promise.all(all().map(probe)) })));

/* ---- highlights: generic, worked out from whatever is connected (counts only, bounded like the overview) */
app.get("/api/insights", h(async () => {
  const probes = await Promise.all(all().map(probe));
  const up = probes.filter((p) => p.ok);
  const byValueDesc = (x, y) => y.value - x.value;
  const largest = up.flatMap((p) => p.containers.filter((c) => c.count != null).map((c) => ({ label: c.name, group: p.name, value: c.count })))
    .sort(byValueDesc).slice(0, 12);
  return {
    records: up.map((p) => ({ label: p.name, value: p.containers.reduce((n, c) => n + (c.count || 0), 0) })).sort(byValueDesc),
    tables: up.map((p) => ({ label: p.name, value: p.containers.length })).sort(byValueDesc),
    largest,
    unreachable: probes.filter((p) => !p.ok).map((p) => ({ name: p.name, error: p.error })),
  };
}));

/* ---- unknown API paths and bad JSON */
app.use("/api", (req, res) => res.status(404).json({ error: "There is no such API route." }));
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "The request body is not valid JSON." });
  if (err?.type === "entity.too.large") return res.status(400).json({ error: "The request body is too large." });
  next(err);
});

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "dist");
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html"))); }

const server = app.listen(port, "127.0.0.1", () => console.log(`OpenETL Lens API on http://127.0.0.1:${port}${fs.existsSync(dist) ? "  (serving the built UI)" : "  (no web/dist yet: use npm run dev, or npm run build)"}`));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { closeAll(); server.close(); process.exit(0); });
process.on("unhandledRejection", (e) => console.error("unhandled", e?.message || e));
