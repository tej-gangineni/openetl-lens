// Hash routes: #home, #highlights, #c/<id>?t=<table>&v=query
export function parseHash() {
  const [path, query = ""] = location.hash.slice(1).split("?");
  const p = new URLSearchParams(query);
  if (path === "highlights") return { page: "highlights" };
  if (path.startsWith("c/")) return { page: "c", id: decodeURIComponent(path.slice(2)), table: p.get("t"), view: p.get("v") === "query" ? "query" : "browse" };
  return { page: "home" };
}
export function connHref(id, { table, view } = {}) {
  const p = new URLSearchParams();
  if (table) p.set("t", table);
  if (view === "query") p.set("v", "query");
  const s = p.toString();
  return `#c/${encodeURIComponent(id)}${s ? `?${s}` : ""}`;
}
export const plural = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
export const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
