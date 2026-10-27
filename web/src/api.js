export async function api(path, options) {
  const r = await fetch("/api" + path, options);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || r.statusText || `Request failed (${r.status})`);
  return body;
}
export const qs = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v ?? "")}`).join("&");
export const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : n ?? "");
export const postJson = (path, body, signal) => api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
export const isAbort = (e) => e && e.name === "AbortError";
export const TYPE_LABEL = { postgres: "PostgreSQL", mongodb: "MongoDB", clickhouse: "ClickHouse", elasticsearch: "Elasticsearch", qdrant: "Qdrant", relata: "Relata" };
export function cellText(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
