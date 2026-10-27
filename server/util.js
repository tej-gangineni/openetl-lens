// Shared helpers: errors, bounds, cursors, value cleaning, a bounded fetch.
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const bad = (m) => new HttpError(400, m);

export const MAX_STR = 2000;
export const MAX_COLS = 40;
export const MAX_BYTES = 2_000_000;
export const COUNT_CAP = 10_001;
export const OFFSET_CAP = 100_000;

export const clampInt = (v, lo, hi, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function clip(s, max = MAX_STR) {
  if (s.length <= max) return s;
  let end = max;
  const c = s.charCodeAt(end - 1);
  if (c >= 0xd800 && c <= 0xdbff) end -= 1; // do not split a surrogate pair
  return s.slice(0, end) + "…";
}

// One cell: numbers/booleans/null stay, strings are cut, everything else becomes a cut JSON string.
export function clean(v, max = MAX_STR) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : String(v);
  if (typeof v === "boolean") return v;
  if (typeof v === "bigint") return Number.isSafeInteger(Number(v)) ? Number(v) : String(v);
  if (typeof v === "string") return clip(v, max);
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (v instanceof Uint8Array) return `<binary ${v.length} bytes>`;
  if (v._bsontype === "Binary") return `<binary ${v.length()} bytes>`;
  if (v._bsontype) return clip(String(v), max);
  try {
    return clip(JSON.stringify(v, (k, x) => (typeof x === "bigint" ? x.toString() : x)) ?? "", max);
  } catch { return "[unreadable value]"; }
}

// Turn raw rows into the response shape: union of keys (max 40), cleaned cells, at most ~2 MB.
export function shape(raw) {
  const cols = [], seen = new Set();
  for (const r of raw) for (const k of Object.keys(r)) if (!seen.has(k) && cols.length < MAX_COLS) { seen.add(k); cols.push(k); }
  const rows = []; let bytes = 0;
  for (const r of raw) {
    const o = {};
    for (const c of cols) o[c] = clean(r[c]);
    const n = JSON.stringify(o).length;
    if (rows.length > 0 && bytes + n > MAX_BYTES) break;
    bytes += n; rows.push(o);
  }
  return { columns: cols, rows };
}

// One whole record for the detail drawer: strings up to 200,000 characters, and if the record is still over ~1.5 MB cut harder.
export function fullRow(obj) {
  if (!obj) return null;
  const build = (max) => Object.fromEntries(Object.entries(obj).slice(0, 80).map(([k, v]) => [k, clean(v, max)]));
  const r = build(200_000);
  return JSON.stringify(r).length > 1_500_000 ? build(20_000) : r;
}

export const encodeCursor = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function decodeCursor(s) {
  if (s === undefined || s === null || s === "") return null;
  try {
    if (typeof s !== "string" || s.length > 500 || !/^[A-Za-z0-9_-]+$/.test(s)) throw 0;
    const o = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    if (!o || typeof o !== "object" || Array.isArray(o)) throw 0;
    return o;
  } catch { throw bad("That cursor is not valid. Start again from the first page."); }
}
export function offsetFrom(cursor) {
  const c = decodeCursor(cursor);
  if (!c) return 0;
  if (!Number.isInteger(c.o) || c.o < 0) throw bad("That cursor is not valid. Start again from the first page.");
  return c.o;
}

export const quoteIdent = (s) => '"' + String(s).replace(/"/g, '""') + '"';
export const quoteBacktick = (s) => "`" + String(s).replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`";
export const escapeLike = (s) => String(s).replace(/[\\%_]/g, "\\$&");
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const NAME = /^[A-Za-z0-9_][A-Za-z0-9_.\-]{0,199}$/;

export async function mapLimit(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// fetch with a timeout and a cap on how many bytes we are willing to read.
export async function http(url, { method = "GET", headers = {}, body, timeout = 5000, maxBytes = 24_000_000 } = {}) {
  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeout), redirect: "error" });
  const chunks = []; let total = 0;
  if (res.body) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) { await reader.cancel().catch(() => {}); throw new HttpError(502, "The store sent more data than Lens will read in one request."); }
      chunks.push(value);
    }
  }
  return { ok: res.ok, status: res.status, text: Buffer.concat(chunks).toString("utf8") };
}
export function json(text) {
  try { return JSON.parse(text); } catch { throw new HttpError(502, "The store sent a reply that is not JSON."); }
}

// Map any thrown thing to { status, error } without leaking credentials.
export function mapError(err, secrets = []) {
  let status = err?.status, msg = String(err?.message || err);
  const code = err?.code ?? err?.cause?.code;
  if (!status) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError" || code === "57014" || code === 50 || err?.codeName === "MaxTimeMSExpired" || /TIMEOUT_EXCEEDED|timed out|timeout/i.test(msg) && !/ECONN/.test(msg)) {
      status = 504; msg = "The store took too long to answer (limit is 5 seconds).";
    } else if (["ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "EHOSTUNREACH", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(code) || err?.name === "MongoServerSelectionError" || /Connection terminated|ECONNREFUSED/.test(msg) || err?.name === "TypeError" && /fetch failed/.test(msg)) {
      status = 502; msg = "Cannot connect to the store. Check the address and that it is running.";
    } else status = 502;
  }
  for (const s of secrets) if (typeof s === "string" && s.length >= 3) msg = msg.replace(new RegExp(s.length < 8 ? `(?<![A-Za-z0-9])${escapeRegex(s)}(?![A-Za-z0-9])` : escapeRegex(s), "g"), "***");
  msg = msg.replace(/:\/\/[^\s/@]*@/g, "://").replace(/\s+/g, " ").trim();
  if (msg.length > 300) msg = msg.slice(0, 300) + "…";
  return { status, error: msg || "The store failed." };
}
