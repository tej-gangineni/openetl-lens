// One adapter per store type. open(config) returns a handle:
//   containers({counts}) -> [{name,count}]    items({container,q,limit,cursor}) -> response body    close()
// Reads are bounded (timeouts, limit, offset caps, capped counts). open(config, {write:true}) returns a handle that can also
// remove(refs): it is only ever opened for the explicit, per-connection delete switch.
const FIELD = /^[A-Za-z_][A-Za-z0-9_.\-]{0,99}$/;
const dirOf = (d) => (String(d).toLowerCase() === "desc" ? "desc" : "asc");
import pg from "pg";
import { MongoClient, ObjectId } from "mongodb";
import {
  HttpError, bad, clampInt, shape, encodeCursor, decodeCursor, offsetFrom, quoteIdent, quoteBacktick,
  escapeLike, escapeRegex, NAME, COUNT_CAP, OFFSET_CAP, MAX_COLS, mapLimit, http, json, clean, fullRow,
} from "./util.js";

// int8 as a JS number when it is safe (pg returns strings by default)
pg.types.setTypeParser(20, (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : v));

const MAX_CONTAINERS = 200;
const parseUrl = (s, what) => { try { return new URL(s); } catch { throw bad(`The ${what} address is not a valid URL.`); } };
const hostOf = (u) => u.hostname.replace(/^\[|\]$/g, "");
const endpoint = (s) => { try { const u = new URL(s); return u.host; } catch { return "unknown"; } };
const sanitizeQ = (q) => String(q || "").slice(0, 200);

/* ---------------------------------------------------------------- PostgreSQL */
function openPostgres(cfg, { write = false } = {}) {
  const u = parseUrl(cfg.url, "PostgreSQL");
  const sslmode = u.searchParams.get("sslmode");
  const pool = new pg.Pool({
    host: hostOf(u), port: Number(u.port) || 5432, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)) || undefined,
    ssl: sslmode && sslmode !== "disable" ? { rejectUnauthorized: false } : undefined,
    max: 3, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 4000, statement_timeout: 5000, query_timeout: 6000,
    options: `${write ? "" : "-c default_transaction_read_only=on "}-c statement_timeout=5000`,
  });
  pool.on("error", () => {});
  const capCount = async (from, params = []) =>
    (await pool.query(`select count(*)::int n from (select 1 from ${from} limit ${COUNT_CAP}) s`, params)).rows[0].n;
  const NUMERIC = new Set(["smallint", "integer", "bigint", "real", "double precision", "boolean"]);
  return {
    pool,
    async containers({ counts = true } = {}) {
      const t = (await pool.query(
        `select c.relname as name, c.reltuples::bigint as est from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relkind in ('r','p') order by 1 limit ${MAX_CONTAINERS}`)).rows;
      if (!counts) return t.map((r) => ({ name: r.name, count: null }));
      return mapLimit(t, 4, async (r) => {
        try {
          const n = await capCount(`public.${quoteIdent(r.name)}`);
          return { name: r.name, count: n >= COUNT_CAP ? Math.max(COUNT_CAP, Number(r.est) || 0) : n };
        } catch { return { name: r.name, count: null }; }
      });
    },
    async items({ container, q, limit, cursor, sort, dir }) {
      const offset = offsetFrom(cursor);
      const colsRes = (await pool.query(
        `select column_name, data_type from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position limit ${MAX_COLS}`, [container])).rows;
      if (!colsRes.length) throw bad(`There is no table called "${container}".`);
      const tbl = `public.${quoteIdent(container)}`;
      const pk = (await pool.query(
        `select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
         where i.indrelid=$1::regclass and i.indisprimary order by array_position(i.indkey::int2[], a.attnum)`, [tbl])).rows.map((r) => r.attname);
      const sel = colsRes.map((c) => NUMERIC.has(c.data_type) ? quoteIdent(c.column_name) : `left(${quoteIdent(c.column_name)}::text, 2001) as ${quoteIdent(c.column_name)}`).join(", ");
      const where = q ? "where t::text ilike $1" : "", params = q ? [`%${escapeLike(q)}%`] : [];
      const tie = pk.length ? pk.map(quoteIdent).join(", ") : "ctid";
      const sc = sort && colsRes.find((c) => c.column_name === sort), d = dirOf(dir);
      const order = sc ? `${quoteIdent(sc.column_name)} ${d} nulls last, ${tie}` : tie;
      if (offset > OFFSET_CAP) return { columns: colsRes.map((c) => c.column_name), rows: [], total: null, totalCapped: false, next: null };
      const total = await capCount(`${tbl} t ${where}`, params);
      const raw = (await pool.query(`select ${sel} from ${tbl} t ${where} order by ${order} limit ${limit + 1} offset ${offset}`, params).catch((e) => { if (e.code === "42883") throw bad(`PostgreSQL cannot sort by "${sort}".`); throw e; })).rows;
      const page = raw.slice(0, limit), s = shape(page);
      const more = raw.length > limit || s.rows.length < page.length;
      const nOff = offset + s.rows.length;
      s.rows.forEach((r, i) => { r.__ref = encodeCursor(pk.length === 1 ? { k: pk[0], v: String(page[i][pk[0]]) } : { o: offset + i, q: q || "", s: sc ? sc.column_name : "", d }); });
      return { sortable: true, columns: s.columns, rows: s.rows, total: Math.min(total, COUNT_CAP), totalCapped: total >= COUNT_CAP, next: more && nOff <= OFFSET_CAP ? encodeCursor({ o: nOff }) : null };
    },
    // the whole record behind a row (no truncation)
    async row({ container, ref }) {
      const r = decodeCursor(ref), tbl = `public.${quoteIdent(container)}`;
      const cols = (await pool.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [container])).rows.map((x) => x.column_name);
      if (!cols.length) throw bad(`There is no table called "${container}".`);
      if (r.k) {
        if (!cols.includes(r.k)) throw bad("That reference is not valid.");
        return fullRow((await pool.query(`select * from ${tbl} where ${quoteIdent(r.k)}::text = $1 limit 1`, [String(r.v)])).rows[0]);
      }
      if (!Number.isInteger(r.o) || r.o < 0 || r.o > OFFSET_CAP) throw bad("That reference is not valid.");
      const pk = (await pool.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid=$1::regclass and i.indisprimary order by array_position(i.indkey::int2[], a.attnum)`, [tbl])).rows.map((x) => x.attname);
      const where = r.q ? "where t::text ilike $1" : "";
      const tie = pk.length ? pk.map(quoteIdent).join(", ") : "ctid", srt = r.s && cols.includes(r.s) ? `${quoteIdent(r.s)} ${dirOf(r.d)} nulls last, ` : "";
      return fullRow((await pool.query(`select * from ${tbl} t ${where} order by ${srt}${tie} limit 1 offset ${r.o}`, r.q ? [`%${escapeLike(r.q)}%`] : [])).rows[0]);
    },
    // delete rows by primary key; tables without a single-column primary key cannot be deleted from safely
    async remove({ container, refs }) {
      if (!write) throw bad("This handle is read only.");
      const cols = (await pool.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [container])).rows;
      if (!cols.length) throw bad(`There is no table called "${container}".`);
      const tbl = `public.${quoteIdent(container)}`;
      const pk = (await pool.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid=$1::regclass and i.indisprimary`, [tbl])).rows.map((x) => x.attname);
      if (pk.length !== 1) throw bad("This table has no single-column primary key, so its rows cannot be deleted safely.");
      const vals = refs.map(decodeCursor).map((r) => { if (!r || r.k !== pk[0]) throw bad("That reference cannot be deleted."); return String(r.v); });
      const res = await pool.query(`delete from ${tbl} where ${quoteIdent(pk[0])}::text = any($1::text[])`, [vals]);
      return { deleted: res.rowCount };
    },
    close: () => pool.end().catch(() => {}),
  };
}

/* ---------------------------------------------------------------- MongoDB */
function openMongodb(cfg, { write = false } = {}) {
  if (!cfg.database) throw bad("A MongoDB database name is required.");
  const client = new MongoClient(cfg.url, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000, socketTimeoutMS: 8000, maxPoolSize: 3, appName: "openetl-lens" });
  let ready;
  const db = async () => { ready ||= client.connect().catch((e) => { ready = null; throw e; }); await ready; return client.db(cfg.database); };
  const MAXT = { maxTimeMS: 5000 };
  const trunc = { $replaceRoot: { newRoot: { $arrayToObject: { $map: { input: { $objectToArray: "$$ROOT" }, as: "f",
    in: { k: "$$f.k", v: { $cond: [{ $eq: [{ $type: "$$f.v" }, "string"] }, { $substrCP: ["$$f.v", 0, 2001] }, "$$f.v"] } } } } } } };
  return {
    db,
    async containers({ counts = true } = {}) {
      const d = await db();
      const names = (await d.listCollections({ type: "collection" }, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system.")).sort().slice(0, MAX_CONTAINERS);
      return mapLimit(names, 4, async (name) => {
        if (!counts) return { name, count: null };
        try { return { name, count: await d.collection(name).estimatedDocumentCount(MAXT) }; } catch { return { name, count: null }; }
      });
    },
    async items({ container, q, limit, cursor, sort, dir }) {
      if (!NAME.test(container)) throw bad("That is not a valid collection name.");
      const offset = offsetFrom(cursor), d = await db();
      if (!(await d.listCollections({ name: container }, { nameOnly: true }).toArray()).length) throw bad(`There is no collection called "${container}".`);
      const col = d.collection(container);
      if (offset > OFFSET_CAP) return { columns: [], rows: [], total: null, totalCapped: false, next: null };
      let filter = {};
      if (q) {
        const sample = await col.findOne({}, { maxTimeMS: 5000 });
        const fields = sample ? Object.keys(sample).filter((k) => k !== "_id" && typeof sample[k] === "string").slice(0, 10) : [];
        filter = fields.length ? { $or: fields.map((f) => ({ [f]: { $regex: escapeRegex(q), $options: "i" } })) } : { _id: { $in: [] } };
      }
      const total = await col.countDocuments(filter, { limit: COUNT_CAP, ...MAXT });
      const raw = await col.aggregate([{ $match: filter }, { $sort: sort && FIELD.test(sort) && sort !== "_id" ? { [sort]: dirOf(dir) === "desc" ? -1 : 1, _id: 1 } : { _id: dirOf(dir) === "desc" && sort === "_id" ? -1 : 1 } }, { $skip: offset }, { $limit: limit + 1 }, trunc], MAXT).toArray();
      const page = raw.slice(0, limit), s = shape(page);
      const more = raw.length > limit || s.rows.length < page.length;
      const nOff = offset + s.rows.length;
      s.rows.forEach((r, i) => { r.__ref = encodeCursor({ v: String(page[i]._id) }); });
      return { sortable: true, columns: s.columns, rows: s.rows, total, totalCapped: total >= COUNT_CAP, next: more && nOff <= OFFSET_CAP ? encodeCursor({ o: nOff }) : null };
    },
    async remove({ container, refs }) {
      if (!write) throw bad("This handle is read only.");
      if (!NAME.test(container)) throw bad("That is not a valid collection name.");
      const ids = [];
      for (const ref of refs) { const v = String(decodeCursor(ref)?.v ?? ""); if (!v) throw bad("That reference cannot be deleted."); ids.push(v); if (/^[0-9a-f]{24}$/i.test(v)) ids.push(new ObjectId(v)); }
      const res = await (await db()).collection(container).deleteMany({ _id: { $in: ids } });
      return { deleted: res.deletedCount };
    },
    async row({ container, ref }) {
      if (!NAME.test(container)) throw bad("That is not a valid collection name.");
      const r = decodeCursor(ref), col = (await db()).collection(container);
      let d = await col.findOne({ _id: r.v }, MAXT);
      if (!d && /^[0-9a-f]{24}$/i.test(String(r.v))) d = await col.findOne({ _id: new ObjectId(String(r.v)) }, MAXT);
      return fullRow(d);
    },
    close: () => client.close().catch(() => {}),
  };
}

/* ---------------------------------------------------------------- ClickHouse */
function openClickhouse(cfg, { write = false } = {}) {
  const base = parseUrl(cfg.url, "ClickHouse");
  const database = cfg.database || "default";
  async function q(sql, params = {}, { mutate = false } = {}) {
    const u = new URL(base);
    u.searchParams.set("database", database); u.searchParams.set("readonly", mutate ? "0" : "2"); u.searchParams.set("max_execution_time", mutate ? "30" : "5");
    u.searchParams.set("output_format_json_quote_64bit_integers", "0");
    for (const [k, v] of Object.entries(params)) u.searchParams.set("param_" + k, String(v));
    const headers = { "X-ClickHouse-User": cfg.user || "default" };
    if (cfg.password) headers["X-ClickHouse-Key"] = cfg.password;
    const r = await http(u, { method: "POST", body: mutate ? sql : sql + " FORMAT JSON", headers, timeout: mutate ? 35_000 : 7000 });
    if (!r.ok) {
      if (/Code: 159|TIMEOUT_EXCEEDED/.test(r.text)) throw new HttpError(504, "The store took too long to answer (limit is 5 seconds).");
      throw new HttpError(/Code: (60|81)\b/.test(r.text) ? 400 : 502, r.text.slice(0, 300));
    }
    return mutate ? null : json(r.text);
  }
  // a row is identified by a hash of its columns: identical rows share one reference and go together
  const hashOf = (cols) => `toString(cityHash64(${cols.map((c) => quoteBacktick(c.name)).join(", ")}))`;
  return {
    q,
    async containers({ counts = true } = {}) {
      const r = await q("select name, total_rows from system.tables where database={db:String} and not startsWith(name, '.inner') order by name limit " + MAX_CONTAINERS, { db: database });
      return r.data.map((t) => ({ name: t.name, count: counts && t.total_rows !== null ? Number(t.total_rows) : null }));
    },
    async items({ container, q: text, limit, cursor, sort, dir }) {
      const offset = offsetFrom(cursor);
      const cols = (await q("select name, type from system.columns where database={db:String} and table={t:String} order by position limit " + MAX_COLS, { db: database, t: container })).data;
      if (!cols.length) throw bad(`There is no table called "${container}".`);
      const tbl = quoteBacktick(container);
      if (offset > OFFSET_CAP) return { columns: cols.map((c) => c.name), rows: [], total: null, totalCapped: false, next: null };
      const sel = cols.map((c) => /^(Nullable\()?(U?Int\d+|Float\d+|Bool)\)?$/.test(c.type) ? quoteBacktick(c.name) : `substring(toString(${quoteBacktick(c.name)}), 1, 2001) as ${quoteBacktick(c.name)}`).join(", ");
      const where = text ? "where " + cols.slice(0, 12).map((c) => `positionCaseInsensitive(toString(${quoteBacktick(c.name)}), {q:String}) > 0`).join(" or ") : "";
      const params = text ? { q: text } : {};
      const total = Number((await q(`select count() as n from (select 1 from ${tbl} ${where} limit ${COUNT_CAP})`, params)).data[0].n);
      const sc = sort && cols.find((c) => c.name === sort), d = dirOf(dir);
      const order = sc ? `${quoteBacktick(sc.name)} ${d}, ${quoteBacktick(cols[0].name)}` : quoteBacktick(cols[0].name);
      const raw = (await q(`select ${sel}, ${hashOf(cols)} as __h from ${tbl} ${where} order by ${order} limit ${limit + 1} offset ${offset}`, params)).data;
      const hashes = raw.map((r) => { const h = r.__h; delete r.__h; return h; });
      const page = raw.slice(0, limit), s = shape(page);
      const more = raw.length > limit || s.rows.length < page.length;
      const nOff = offset + s.rows.length;
      s.rows.forEach((r, i) => { r.__ref = encodeCursor({ h: hashes[i] }); });
      return { sortable: true, columns: s.columns, rows: s.rows, total, totalCapped: total >= COUNT_CAP, next: more && nOff <= OFFSET_CAP ? encodeCursor({ o: nOff }) : null };
    },
    async row({ container, ref }) {
      const r = decodeCursor(ref);
      if (!/^\d{1,20}$/.test(String(r?.h))) throw bad("That reference is not valid.");
      const cols = (await q("select name from system.columns where database={db:String} and table={t:String} order by position limit " + MAX_COLS, { db: database, t: container })).data;
      if (!cols.length) throw bad(`There is no table called "${container}".`);
      return fullRow((await q(`select * from ${quoteBacktick(container)} where ${hashOf(cols)} = {h:String} limit 1`, { h: r.h })).data[0]);
    },
    async remove({ container, refs }) {
      if (!write) throw bad("This handle is read only.");
      const cols = (await q("select name from system.columns where database={db:String} and table={t:String} order by position limit " + MAX_COLS, { db: database, t: container })).data;
      if (!cols.length) throw bad(`There is no table called "${container}".`);
      const hs = refs.map((x) => String(decodeCursor(x)?.h));
      if (!hs.every((h) => /^\d{1,20}$/.test(h))) throw bad("That reference cannot be deleted.");
      const cond = `${hashOf(cols)} in (${hs.map((h) => `'${h}'`).join(",")})`;
      const n = Number((await q(`select count() as n from ${quoteBacktick(container)} where ${cond}`)).data[0].n);
      await q(`alter table ${quoteBacktick(container)} delete where ${cond} settings mutations_sync=1`, {}, { mutate: true });
      return { deleted: n };
    },
    close() {},
  };
}

/* ---------------------------------------------------------------- Elasticsearch */
function openElasticsearch(cfg, { write = false } = {}) {
  const base = parseUrl(cfg.url, "Elasticsearch").origin + parseUrl(cfg.url, "Elasticsearch").pathname.replace(/\/$/, "");
  async function req(path, body) {
    const headers = { "content-type": "application/json" };
    if (cfg.apiKey) headers.authorization = `ApiKey ${cfg.apiKey}`;
    const r = await http(base + path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) {
      if (r.status === 404) throw bad("There is no such index.");
      if (/fielddata|Text fields are not optimised|No mapping found/.test(r.text)) throw bad("Elasticsearch cannot sort on that field (text fields cannot be sorted). Pick a number, date or keyword field.");
      throw new HttpError(r.status === 400 ? 400 : 502, `Elasticsearch said: ${r.text.slice(0, 250)}`);
    }
    return json(r.text);
  }
  return {
    req,
    async containers({ counts = true } = {}) {
      const r = await req("/_cat/indices?format=json&h=index,docs.count&expand_wildcards=open");
      return r.filter((i) => !i.index.startsWith(".")).sort((a, b) => a.index.localeCompare(b.index)).slice(0, MAX_CONTAINERS)
        .map((i) => ({ name: i.index, count: counts && i["docs.count"] != null ? Number(i["docs.count"]) : null }));
    },
    async items({ container, q, limit, cursor, sort, dir }) {
      if (!NAME.test(container) || /^[._]/.test(container)) throw bad("That is not a valid index name.");
      const from = offsetFrom(cursor);
      if (from >= 10_000) return { columns: [], rows: [], total: null, totalCapped: false, next: null };
      const size = Math.min(limit, 10_000 - from);
      const r = await req(`/${encodeURIComponent(container)}/_search?timeout=5s`, {
        size, from, timeout: "5s", track_total_hits: COUNT_CAP, sort: sort && FIELD.test(sort) && sort !== "_id" ? [{ [sort]: { order: dirOf(dir), unmapped_type: "keyword" } }, "_doc"] : ["_doc"],
        query: q ? { simple_query_string: { query: q, default_operator: "and", lenient: true } } : { match_all: {} },
      });
      const raw = r.hits.hits.map((h) => ({ _id: h._id, ...(h._source || {}) }));
      const s = shape(raw);
      const nFrom = from + s.rows.length;
      const more = (raw.length === size || s.rows.length < raw.length) && nFrom < 10_000;
      const t = r.hits.total;
      s.rows.forEach((r, i) => { r.__ref = encodeCursor({ v: String(raw[i]._id) }); });
      return { sortable: true, columns: s.columns, rows: s.rows, total: t.value, totalCapped: t.relation === "gte", next: more ? encodeCursor({ o: nFrom }) : null };
    },
    async remove({ container, refs }) {
      if (!write) throw bad("This handle is read only.");
      if (!NAME.test(container) || /^[._]/.test(container)) throw bad("That is not a valid index name.");
      const ids = refs.map((x) => String(decodeCursor(x)?.v ?? "")).filter(Boolean);
      if (ids.length !== refs.length) throw bad("That reference cannot be deleted.");
      const r = await req(`/${encodeURIComponent(container)}/_delete_by_query?refresh=true&conflicts=proceed`, { query: { ids: { values: ids } } });
      return { deleted: r.deleted ?? 0 };
    },
    async row({ container, ref }) {
      if (!NAME.test(container) || /^[._]/.test(container)) throw bad("That is not a valid index name.");
      const d = await req(`/${encodeURIComponent(container)}/_doc/${encodeURIComponent(String(decodeCursor(ref).v))}`);
      return fullRow({ _id: d._id, ...(d._source || {}) });
    },
    close() {},
  };
}

/* ---------------------------------------------------------------- Qdrant */
function openQdrant(cfg, { write = false } = {}) {
  const base = parseUrl(cfg.url, "Qdrant").origin + parseUrl(cfg.url, "Qdrant").pathname.replace(/\/$/, "");
  async function req(path, body) {
    const headers = { "content-type": "application/json" };
    if (cfg.apiKey) headers["api-key"] = cfg.apiKey;
    const r = await http(base + path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) {
      if (r.status === 404) throw bad("There is no such collection.");
      throw new HttpError(r.status === 400 ? 400 : 502, `Qdrant said: ${r.text.slice(0, 250)}`);
    }
    return json(r.text).result;
  }
  const row = (p) => { const o = { id: p.id, ...(p.payload || {}) }; Object.defineProperty(o, "__pid", { value: p.id }); return o; };
  const validOffset = (o) => o === null || typeof o === "number" && Number.isInteger(o) && o >= 0 || typeof o === "string" && /^[0-9a-fA-F-]{8,40}$/.test(o);
  return {
    req,
    async containers({ counts = true } = {}) {
      const names = (await req("/collections")).collections.map((c) => c.name).sort().slice(0, MAX_CONTAINERS);
      return mapLimit(names, 4, async (name) => {
        if (!counts) return { name, count: null };
        try { return { name, count: (await req(`/collections/${encodeURIComponent(name)}`)).points_count ?? null }; } catch { return { name, count: null }; }
      });
    },
    async items({ container, q, limit, cursor }) {
      if (!NAME.test(container)) throw bad("That is not a valid collection name.");
      const c = decodeCursor(cursor);
      let offset = null;
      if (c) { if (!("o" in c) || !validOffset(c.o)) throw bad("That cursor is not valid. Start again from the first page."); offset = c.o; }
      const path = `/collections/${encodeURIComponent(container)}/points/scroll`;
      const scroll = (n, off) => req(path, { limit: n, offset: off, with_payload: true, with_vector: false });
      const needle = q ? q.toLowerCase() : null;
      let raw = [], next = null, total, totalCapped = false;
      if (!needle) {
        const r = await scroll(limit + 1, offset);
        raw = r.points.slice(0, limit).map(row);
        // the extra point (or next_page_offset) tells us where the next page begins
        next = r.points.length > limit ? r.points[limit].id : r.next_page_offset ?? null;
        try { total = (await req(`/collections/${encodeURIComponent(container)}`)).points_count ?? null; } catch { total = null; }
      } else {
        // bounded scan: at most 2,000 points per request, then hand back a cursor so the client can continue
        let budget = 2000, cur = offset; total = null;
        while (budget > 0 && raw.length < limit) {
          const n = Math.min(250, budget);
          const r = await scroll(n, cur);
          budget -= r.points.length;
          let stoppedAt = -1;
          for (let i = 0; i < r.points.length; i++) {
            if (JSON.stringify(r.points[i].payload || {}).toLowerCase().includes(needle)) {
              raw.push(row(r.points[i]));
              if (raw.length >= limit) { stoppedAt = i; break; }
            }
          }
          if (stoppedAt >= 0) { next = r.points[stoppedAt + 1]?.id ?? r.next_page_offset ?? null; break; }
          cur = r.next_page_offset ?? null; next = cur;
          if (cur === null) break;
        }
      }
      const s = shape(raw);
      if (s.rows.length < raw.length) next = raw[s.rows.length].id; // response size cap: resume at the first dropped point
      s.rows.forEach((r, i) => { r.__ref = encodeCursor({ v: raw[i].__pid }); });
      return { sortable: false, columns: s.columns, rows: s.rows, total, totalCapped, next: next === null || next === undefined ? null : encodeCursor({ o: next }) };
    },
    async remove({ container, refs }) {
      if (!write) throw bad("This handle is read only.");
      if (!NAME.test(container)) throw bad("That is not a valid collection name.");
      const ids = refs.map((x) => decodeCursor(x)?.v);
      if (!ids.every((id) => (typeof id === "number" && Number.isInteger(id) && id >= 0) || (typeof id === "string" && /^[0-9a-fA-F-]{8,40}$/.test(id)))) throw bad("That reference cannot be deleted.");
      await req(`/collections/${encodeURIComponent(container)}/points/delete?wait=true`, { points: ids });
      return { deleted: ids.length };
    },
    async row({ container, ref }) {
      if (!NAME.test(container)) throw bad("That is not a valid collection name.");
      const id = decodeCursor(ref).v;
      if (!(typeof id === "number" && Number.isInteger(id) && id >= 0) && !(typeof id === "string" && /^[0-9a-fA-F-]{8,40}$/.test(id))) throw bad("That reference is not valid.");
      const p = (await req(`/collections/${encodeURIComponent(container)}/points`, { ids: [id], with_payload: true, with_vector: false }))[0];
      return p ? fullRow({ id: p.id, ...(p.payload || {}) }) : null;
    },
    close() {},
  };
}

/* ---------------------------------------------------------------- Relata */
const TYPE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,99}$/;
export const relataTypes = (cfg) => String(cfg.types || "DocumentChunk").split(",").map((s) => s.trim()).filter(Boolean);
function openRelata(cfg, { write = false } = {}) {
  const base = parseUrl(cfg.url, "Relata").origin;
  async function run(sql, timeout = 8000) {
    if (!cfg.token) throw bad("No Relata token is set. Add RELATA_TOKEN to .env or save the connection with a token.");
    const r = await http(base + "/query", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` }, body: JSON.stringify({ sql }), timeout });
    let d; try { d = JSON.parse(r.text); } catch { d = { detail: r.text.slice(0, 250) }; }
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) throw new HttpError(502, "Relata rejected the token.");
      throw new HttpError(r.status >= 500 ? 502 : 400, String(d.detail || d.title || d.error || `Relata returned ${r.status}`).slice(0, 300));
    }
    return d;
  }
  const count = async (t) => { const d = await run(`SELECT COUNT(*) FROM ${t}`, 5000); const v = Object.values(d.data?.[0] || {})[0]; return v === undefined ? null : Number(v); };
  return {
    async containers({ counts = true } = {}) {
      const types = relataTypes(cfg).filter((t) => TYPE_NAME.test(t));
      return mapLimit(types, 3, async (name) => {
        if (!counts) { await run(`SELECT * FROM ${name} LIMIT 1`, 5000); return { name, count: null }; } // proves token + type work
        return { name, count: await count(name) };
      });
    },
    async items({ container, limit, cursor, sort, dir }) {
      if (!TYPE_NAME.test(container) || !relataTypes(cfg).includes(container)) throw bad(`"${container}" is not one of this connection's types.`);
      const offset = offsetFrom(cursor);
      if (offset > OFFSET_CAP) return { columns: [], rows: [], total: null, totalCapped: false, next: null };
      const order = sort && TYPE_NAME.test(sort) ? ` ORDER BY ${sort} ${dirOf(dir).toUpperCase()}` : "";
      const [d, total] = await Promise.all([run(`SELECT * FROM ${container}${order} LIMIT ${limit + 1} OFFSET ${offset}`), count(container).catch(() => null)]);
      const raw = d.data || [], page = raw.slice(0, limit), s = shape(page);
      const more = raw.length > limit || s.rows.length < page.length;
      const nOff = offset + s.rows.length;
      // a row can be deleted when the page has a column that identifies it: "id" or "*_id", filled in and different on every row
      const keyCol = s.columns.find((c) => (c === "id" || c.endsWith("_id")) && s.rows.every((r) => typeof r[c] === "string" && r[c]) && new Set(s.rows.map((r) => r[c])).size === s.rows.length);
      s.rows.forEach((r, i) => { r.__ref = encodeCursor(keyCol ? { k: keyCol, v: r[keyCol], o: offset + i } : { o: offset + i }); });
      return { sortable: true, columns: s.columns, rows: s.rows, total, totalCapped: false, next: more && nOff <= OFFSET_CAP ? encodeCursor({ o: nOff }) : null };
    },
    async row({ container, ref }) {
      if (!TYPE_NAME.test(container) || !relataTypes(cfg).includes(container)) throw bad(`"${container}" is not one of this connection's types.`);
      const o = decodeCursor(ref).o;
      if (!Number.isInteger(o) || o < 0 || o > OFFSET_CAP) throw bad("That reference is not valid.");
      return fullRow((await run(`SELECT * FROM ${container} LIMIT 1 OFFSET ${o}`)).data?.[0]);
    },
    async remove({ container, refs }) {
      if (!write) throw bad("This handle is read only.");
      if (!TYPE_NAME.test(container) || !relataTypes(cfg).includes(container)) throw bad(`"${container}" is not one of this connection's types.`);
      const rs = refs.map(decodeCursor);
      const k = rs[0]?.k;
      if (!k || !TYPE_NAME.test(k) || !rs.every((r) => r.k === k && typeof r.v === "string" && r.v.length <= 200)) throw bad("Those rows have no id column, so they cannot be deleted safely.");
      const list = rs.map((r) => `'${r.v.replace(/'/g, "''")}'`).join(", ");
      const d = await run(`DELETE FROM ${container} WHERE ${k} IN (${list})`, 15_000);
      return { deleted: Number(d.deleted ?? 0) };
    },
    async query(sql) {
      const s = String(sql || "").trim().replace(/;+\s*$/, "");
      if (!s) throw bad("Write a query first.");
      if (s.length > 5000) throw bad("The query is too long (5,000 characters at most).");
      const unquoted = s.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"/g, "");
      if (!/^(select|hybrid_search)\b/i.test(s)) throw bad("Only SELECT and HYBRID_SEARCH queries are allowed here.");
      if (unquoted.includes(";")) throw bad("Send one statement at a time: remove the semicolon in the middle of the query.");
      const d = await run(s, 10_000);
      const all = d.data || [], sh = shape(all.slice(0, 200));
      return { columns: d.columns && !all.length ? d.columns.slice(0, MAX_COLS) : sh.columns, rows: sh.rows, total: all.length, totalCapped: false, next: null, ms: d.processing_time_ms ?? null };
    },
    close() {},
  };
}

export const TYPES = {
  postgres: { open: openPostgres, kind: "tables", endpoint: (c) => { try { const u = new URL(c.url); return `${u.host}${u.pathname}`; } catch { return "unknown"; } } },
  mongodb: { open: openMongodb, kind: "collections", endpoint: (c) => `${endpoint(c.url.replace(/^mongodb(\+srv)?:\/\/[^@/]*@/, "http://").replace(/^mongodb(\+srv)?:\/\//, "http://"))}/${c.database}` },
  clickhouse: { open: openClickhouse, kind: "tables", endpoint: (c) => `${endpoint(c.url)}/${c.database || "default"}` },
  elasticsearch: { open: openElasticsearch, kind: "indices", endpoint: (c) => endpoint(c.url) },
  qdrant: { open: openQdrant, kind: "collections", endpoint: (c) => endpoint(c.url) },
  relata: { open: openRelata, kind: "types", endpoint: (c) => endpoint(c.url) },
};
export { clean, TYPE_NAME };
