# OpenETL Lens: API contract (v2)

One small app that reads, and (only where you switch it on) deletes rows. `server/index.js` (Node, Express) talks to databases; `web/` (React + Vite) talks only to `/api`.
Goals: (1) any data source can be connected at runtime, (2) scrolling is free and never hangs, (3) every read is paginated and bounded.

## Ground rules (server)
- READ ONLY by default. Never run INSERT/UPDATE/DDL. The only write is deleting the rows a user selected, and only on a connection where `writable` has been switched on (see Deleting rows). PostgreSQL connections set `default_transaction_read_only=on`; ClickHouse uses `readonly=2`;
  Relata allows one `SELECT` or `HYBRID_SEARCH` statement only.
- Every request is bounded: PostgreSQL `statement_timeout=5000`; MongoDB `maxTimeMS: 5000`; ClickHouse `max_execution_time=5`;
  Elasticsearch `timeout=5s`; all `fetch` calls use `AbortSignal.timeout`. A timeout returns HTTP 504 `{error}`.
- `limit` is clamped to 1..200 (default 100). Never load a whole table, collection, index or file into memory.
- Strings in any returned row are cut at 2,000 characters and end with `…`. Nested objects/arrays become a JSON string cut the same way.
  Numbers, booleans and null stay as they are. A response never carries more than ~2 MB; if it would, return fewer rows.
- Credentials are never sent to the browser. Errors are `{ "error": "plain sentence" }` with 400 (bad input), 404 (unknown id), 502 (store failed), 504 (timeout).

## Connections
Built-in connections come from env vars (see `.env.example`) with these fixed ids: `pg`, `mongo`, `ch`, `es`, `qdrant`, `relata`. They are the *sample connections*: deleting one only hides it (its id is kept in `connections.json`), and it can be restored.
User connections are saved in `connections.json` next to `package.json` (gitignored, file mode 600), ids look like `c_ab12cd`.

`GET /api/connections` -> `{ "connections": [ { "id", "name", "type", "summary", "builtin": true|false } ], "hiddenDefaults": 0 }`  (`hiddenDefaults` = how many sample connections are currently removed)
`type` is one of `postgres | mongodb | clickhouse | elasticsearch | qdrant | relata`. `summary` is a masked one-liner such as `postgres @ 127.0.0.1:5433/openetl` (no password).

`POST /api/connections/test` body `{ "name", "type", "config" }` -> `{ "ok": true, "containers": <number> }` or `{ "error" }` (tries to list containers within 5 s).
`POST /api/connections` same body; tests first, then saves -> `{ "connection": {...} }`.   `DELETE /api/connections/:id` -> `{ "ok": true }` for ANY connection (a sample connection is hidden, not erased).   `POST /api/connections/restore-defaults` -> `{ "restored": <number> }` brings the hidden sample connections back.

`config` per type:
| type | fields |
|---|---|
| postgres | `url` (postgresql://user:pass@host:port/db) |
| mongodb | `url`, `database` |
| clickhouse | `url` (http://host:8123), `user`, `password`, `database` |
| elasticsearch | `url`, `apiKey` (optional) |
| qdrant | `url`, `apiKey` (optional) |
| relata | `url`, `token`, `types` (comma-separated type names to list, default `DocumentChunk`) |

## Browsing (works for any data, no assumptions about column names)
`GET /api/c/:id/containers` -> `{ "containers": [ { "name", "count": number|null } ] }`
  postgres: tables in schema `public`; mongodb: collections; clickhouse: tables; elasticsearch: indices not starting with `.`; qdrant: collections; relata: the configured `types`.
  `count` may be null if it would be slow.

`GET /api/c/:id/items?container=NAME&q=TEXT&limit=100&cursor=OPAQUE` ->
```json
{ "columns": ["a","b"], "rows": [ {"a": 1, "b": "x"} ], "total": 1234, "totalCapped": false, "next": "opaque-or-null" }
```
- `columns`: union of keys of the returned rows, in a stable order, max 40.
- `total`: matches for this query, or null if unknown. If counting would be slow, count at most 10,001 and set `totalCapped: true` (meaning "at least").
- `next`: pass it back as `cursor` for the next page. `null` means the end. Treat `cursor` as opaque in the UI.
- `q` is a plain text search over the whole record, case-insensitive:
  postgres `row::text ILIKE`; mongodb regex over up to 10 string fields found in a sample document; clickhouse `positionCaseInsensitive` over the first 12 columns cast to strings;
  elasticsearch `simple_query_string` on all fields (default operator AND); qdrant scans payload JSON in bounded chunks; relata applies a `WHERE`-free fallback: `q` is ignored (use the query console).
- Paging per store: postgres/clickhouse/mongodb use offset in the cursor (max offset 100,000, beyond it return `next: null`); elasticsearch uses `from` (max 10,000);
  qdrant uses its native scroll cursor and, when `q` is set, scans at most 2,000 points per request and returns `next` so the client can continue; relata uses `LIMIT/OFFSET` if the server supports it, otherwise a single page.
- Stable order: postgres by primary key if it exists else `ctid`; mongodb by `_id`; clickhouse by the first column; elasticsearch by `_doc` order; qdrant by its own order.

Each row from `items` also carries a hidden string `__ref` (never listed in `columns`). `GET /api/c/:id/row?container=NAME&ref=REF` -> `{ "row": {...} }` returns that one record whole (strings up to 200,000 characters), for the detail drawer when a value was cut at 2,000 characters.

`POST /api/c/:id/query` (relata only, 400 for other types) body `{ "sql": "SELECT ..." }` -> same shape as items with `next: null`, plus `ms`.

## Overview and insights (unchanged paths, now bounded)
`GET /api/overview` -> `{ "sources": [ { "id", "name", "kind", "url", "ok", "error"?, "containers": [ {name,count} ] } ] }` for ALL connections (built-in and user), each probed with a 4 s timeout, in parallel.
`GET /api/insights` -> computed from the built-in lab stores only; each part fails independently (`{error}`) and scans at most 2,000 Qdrant points.

## Web UI behaviour (React)
The screens, layout and UX rules are in `.claude/skills/lens-ui/SKILL.md`. What matters for the API:
- Browsing uses infinite scroll: page size 100, one request in flight, stale requests aborted, search debounced 300 ms, and at most 3,000 rows mounted (then a "Load the next 1,000" button).
- Show the total as "1,234 rows" or "at least 10,001 rows" when `totalCapped`. Never block the page on a slow store: skeletons per panel, and the server's `error` text with a Retry on failure.
- Columns are generic (first 8 shown, the rest in the row drawer). A value cut at 2,000 characters is completed with `GET /api/c/:id/row`.

## Sorting
`GET /api/c/:id/items` also takes `sort=COLUMN&dir=asc|desc`. The response carries `sortable: true|false`. Every store sorts on the server (Qdrant cannot, so it returns `sortable: false` and ignores `sort`). Elasticsearch cannot sort `text` fields and says so with a 400. Sorting keeps the same paging rules: cursor and limits are unchanged.

## Deleting rows (off by default)
- `PATCH /api/connections/:id/writable` body `{ "writable": true|false }` switches deleting on or off for one connection; it is stored in `connections.json` as `writable: [ids]`. `GET /api/connections` returns `writable` on each connection.
- `POST /api/c/:id/rows/delete` body `{ "container": "table", "refs": ["<__ref>", ...] }` (1 to 200 refs) -> `{ "deleted": n }`. 403 when `writable` is off. Rows are named by their `__ref`:
  postgres by single-column primary key (tables without one are refused); mongodb by `_id`; clickhouse by a hash of the row's columns (identical rows go together); elasticsearch by `_id`; qdrant by point id; relata by an `id` or `*_id` column that is filled in and unique on the page (otherwise refused).
- Deletes use a separate handle that is opened only for this call. The normal handle stays read only (PostgreSQL `default_transaction_read_only=on`, ClickHouse `readonly=2`).
