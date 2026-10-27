// Connection registry: sample connections from env, your own connections in connections.json (mode 600, gitignored).
// Removing a sample connection only hides it (its id goes in "hidden"); restoreDefaults() brings them back.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { bad, HttpError } from "./util.js";
import { TYPES, relataTypes, TYPE_NAME } from "./stores.js";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "connections.json");
const MAX_USER = 50;
const e = process.env;

export const builtins = () => [
  { id: "pg", name: "PostgreSQL", type: "postgres", config: { url: e.PG_URL || "postgresql://lab:lab@127.0.0.1:5433/openetl" } },
  { id: "mongo", name: "MongoDB", type: "mongodb", config: { url: e.MONGO_URL || "mongodb://127.0.0.1:27017", database: e.MONGO_DB || "openetl" } },
  { id: "ch", name: "ClickHouse", type: "clickhouse", config: { url: e.CH_URL || "http://127.0.0.1:8123", user: e.CH_USER || "lab", password: e.CH_PASSWORD || "lab", database: e.CH_DB || "openetl" } },
  { id: "es", name: "Elasticsearch", type: "elasticsearch", config: { url: e.ES_URL || "http://127.0.0.1:9200", apiKey: e.ES_API_KEY || "" } },
  { id: "qdrant", name: "Qdrant", type: "qdrant", config: { url: e.QDRANT_URL || "http://127.0.0.1:6333", apiKey: e.QDRANT_API_KEY || "" } },
  { id: "relata", name: "Relata", type: "relata", config: { url: e.RELATA_URL || "http://127.0.0.1:9090", token: e.RELATA_TOKEN || "", types: e.RELATA_TYPES || "DocumentChunk" } },
].map((c) => ({ ...c, builtin: true }));

function readFile() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")) || {}; } catch { return {}; }
}
const readUser = () => (Array.isArray(readFile().connections) ? readFile().connections.filter((c) => c && c.id && TYPES[c.type]) : []);
const readHidden = () => (Array.isArray(readFile().hidden) ? readFile().hidden.filter((x) => typeof x === "string") : []);
// ids of the connections where deleting rows has been switched on (off by default)
const readWritable = () => (Array.isArray(readFile().writable) ? readFile().writable.filter((x) => typeof x === "string") : []);
function writeFileState(list, hidden, writable = readWritable()) {
  if (!list.length && !hidden.length && !writable.length) { try { fs.unlinkSync(FILE); } catch {} return; }
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ connections: list, hidden, writable }, null, 2), { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, FILE);
}
const writeUser = (list) => writeFileState(list, readHidden());

export const all = () => { const hide = new Set(readHidden()); return [...builtins().filter((b) => !hide.has(b.id)), ...readUser().map((c) => ({ ...c, builtin: false }))]; };
export const hiddenCount = () => { const ids = new Set(builtins().map((b) => b.id)); return readHidden().filter((id) => ids.has(id)).length; };
export const find = (id) => all().find((c) => c.id === id);
export function mustFind(id) {
  const c = typeof id === "string" && /^[A-Za-z0-9_]{1,40}$/.test(id) ? find(id) : null;
  if (!c) throw new HttpError(404, "There is no connection with that id.");
  return c;
}
export const secrets = (c) => [c.config?.password, c.config?.token, c.config?.apiKey, (() => { try { return decodeURIComponent(new URL(c.config?.url).password); } catch { return ""; } })()].filter(Boolean);

export const isWritable = (id) => readWritable().includes(id);
export function setWritable(id, on) {
  if (!find(id)) throw new HttpError(404, "There is no connection with that id.");
  const rest = readWritable().filter((x) => x !== id);
  writeFileState(readUser(), readHidden(), on ? [...rest, id] : rest);
}
export const publicView = (c) => ({ id: c.id, name: c.name, type: c.type, summary: `${c.type} @ ${TYPES[c.type].endpoint(c.config)}`, builtin: !!c.builtin, writable: isWritable(c.id) });

const str = (v, what, { required = true, max = 2000 } = {}) => {
  if (v === undefined || v === null || v === "") { if (required) throw bad(`${what} is required.`); return ""; }
  if (typeof v !== "string") throw bad(`${what} must be text.`);
  if (v.length > max) throw bad(`${what} is too long.`);
  return v.trim();
};
const url = (v, what, protocols) => {
  const s = str(v, what);
  let u; try { u = new URL(s); } catch { throw bad(`${what} is not a valid URL.`); }
  if (!protocols.includes(u.protocol)) throw bad(`${what} must start with ${protocols.map((p) => p + "//").join(" or ")}.`);
  return s;
};

export function validate(body) {
  if (!body || typeof body !== "object") throw bad("Send a JSON body with name, type and config.");
  const name = str(body.name, "Name", { max: 60 }), type = body.type, c = body.config;
  if (!TYPES[type]) throw bad("Type must be one of postgres, mongodb, clickhouse, elasticsearch, qdrant, relata.");
  if (!c || typeof c !== "object") throw bad("Config is required.");
  const http = ["http:", "https:"];
  let config;
  switch (type) {
    case "postgres": config = { url: url(c.url, "URL", ["postgres:", "postgresql:"]) }; break;
    case "mongodb": config = { url: url(c.url, "URL", ["mongodb:", "mongodb+srv:"]), database: str(c.database, "Database", { max: 100 }) }; break;
    case "clickhouse": config = { url: url(c.url, "URL", http), user: str(c.user, "User", { required: false, max: 200 }) || "default", password: str(c.password, "Password", { required: false }), database: str(c.database, "Database", { required: false, max: 200 }) || "default" }; break;
    case "elasticsearch": case "qdrant": config = { url: url(c.url, "URL", http), apiKey: str(c.apiKey, "API key", { required: false }) }; break;
    case "relata": {
      const types = str(c.types, "Types", { required: false, max: 1000 }) || "DocumentChunk";
      if (!relataTypes({ types }).every((t) => TYPE_NAME.test(t))) throw bad("Types must be comma-separated type names (letters, digits, underscore).");
      config = { url: url(c.url, "URL", http), token: str(c.token, "Token"), types }; break;
    }
  }
  return { name, type, config };
}

// open, call fn, always close: used for one-off tests of a connection that is not saved yet
export async function withTemp(conn, fn) {
  const h = TYPES[conn.type].open(conn.config);
  try { return await fn(h); } finally { await h.close(); }
}

export function addUser(v) {
  const list = readUser();
  if (list.length >= MAX_USER) throw bad(`At most ${MAX_USER} saved connections are allowed.`);
  const conn = { id: "c_" + crypto.randomBytes(3).toString("hex"), name: v.name, type: v.type, config: v.config };
  writeUser([...list, conn]);
  return { ...conn, builtin: false };
}
// Delete any connection. A sample connection (from env) is hidden, not erased, so it can be restored.
export function removeConnection(id) {
  const c = find(id);
  if (!c) throw new HttpError(404, "There is no connection with that id.");
  const writable = readWritable().filter((x) => x !== id);
  if (c.builtin) writeFileState(readUser(), [...new Set([...readHidden(), id])], writable);
  else writeFileState(readUser().filter((x) => x.id !== id), readHidden(), writable);
}
export function restoreDefaults() {
  const n = hiddenCount();
  writeFileState(readUser(), []);
  return n;
}

// handle cache: one open pool/client per connection
const handles = new Map();
// { write: true } opens the separate handle that can delete rows; the normal handle stays read only
export function handleFor(conn, { write = false } = {}) {
  const key = JSON.stringify(conn.config), slot = write ? conn.id + ":w" : conn.id;
  const hit = handles.get(slot);
  if (hit && hit.key === key) return hit.handle;
  if (hit) hit.handle.close();
  const handle = TYPES[conn.type].open(conn.config, { write });
  handles.set(slot, { key, handle });
  return handle;
}
export function dropHandle(id) { for (const slot of [id, id + ":w"]) { const h = handles.get(slot); if (h) { handles.delete(slot); h.handle.close(); } } }
export function closeAll() { for (const [, h] of handles) h.handle.close(); handles.clear(); }
