import { useCallback, useEffect, useRef, useState } from "react";
import { api, qs, isAbort } from "./api.js";

export const PAGE = 100; // rows per request
export const MAX_ROWS = 3000; // rows mounted at once
export const DROP = 1000; // rows that leave the view when the user asks for more

// Which columns to show first: ids, then columns people read, then the rest, with internal metadata last.
const READABLE = /^(text|title|name|subject|body|content|description|summary|message|source_filename|filename|category|status|priority|region)$/i;
const INTERNAL = /(metadata|sha256|job_run_id|schema_version|extraction_method|section_path_tier|sequence_index|source_path|source_uri|source_media_type|^__)/i;
const rank = (k) => (/^_?id$/i.test(k) ? 0 : READABLE.test(k) ? 1 : INTERNAL.test(k) ? 3 : 2);
export const rankColumns = (cols) => cols.map((c, i) => [c, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);

// Pages of rows for one table: one request in flight, stale requests aborted when the table, the search
// or the connection change, at most MAX_ROWS rows kept.
export function useRows(connId, container, q, enabled = true, sort = null) {
  const sortCol = sort?.col || "", sortDir = sort?.dir || "asc";
  const [s, setS] = useState({ sortable: true, rows: [], dropped: 0, columns: [], numeric: new Set(), total: null, capped: false, loading: false, error: "", done: false });
  const [nonce, setNonce] = useState(0);
  const ctrl = useRef(null), gen = useRef(0), inflight = useRef(false), cursor = useRef(null), seq = useRef(0);

  const fetchPage = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setS((p) => ({ ...p, loading: true }));
    const my = gen.current, c = new AbortController();
    ctrl.current = c;
    try {
      const first = !cursor.current;
      const d = await api(`/c/${encodeURIComponent(connId)}/items?${qs({ container, q, limit: PAGE, ...(sortCol ? { sort: sortCol, dir: sortDir } : {}), ...(cursor.current ? { cursor: cursor.current } : {}) })}`, { signal: c.signal });
      if (my !== gen.current) return;
      cursor.current = d.next ?? null;
      setS((p) => {
        const incoming = d.columns || [];
        const columns = p.columns.length ? [...p.columns, ...incoming.filter((k) => !p.columns.includes(k))].slice(0, 40) : rankColumns(incoming);
        let numeric = p.numeric;
        if (first) {
          numeric = new Set();
          for (const k of incoming) {
            const vals = d.rows.map((r) => r[k]).filter((v) => v !== null && v !== undefined);
            if (vals.length && vals.every((v) => typeof v === "number")) numeric.add(k);
          }
        }
        return {
          ...p, columns, numeric, sortable: d.sortable !== false, error: "", done: !d.next,
          rows: p.rows.concat(d.rows.map((r) => ({ k: ++seq.current, r }))),
          total: d.total ?? null, capped: !!d.totalCapped,
        };
      });
    } catch (e) {
      if (my === gen.current && !isAbort(e)) setS((p) => ({ ...p, error: e.message }));
    } finally {
      if (my === gen.current) { inflight.current = false; setS((p) => ({ ...p, loading: false })); }
    }
  }, [connId, container, q, sortCol, sortDir]);

  // table, search or connection changed (or first mount): cancel, clear, load the first page
  useEffect(() => {
    ctrl.current?.abort();
    gen.current++;
    inflight.current = false;
    cursor.current = null;
    setS((p) => ({ sortable: p.sortable, rows: [], dropped: 0, columns: p.columns, numeric: new Set(), total: null, capped: false, loading: false, error: "", done: false }));
    if (enabled && container) fetchPage();
    return () => ctrl.current?.abort();
  }, [fetchPage, enabled, container, nonce]);

  const loadMore = useCallback(() => { fetchPage(); }, [fetchPage]);
  const retry = useCallback(() => { setS((p) => ({ ...p, error: "" })); fetchPage(); }, [fetchPage]);
  // the first 1,000 rows leave the view so the page never holds more than MAX_ROWS
  const dropFirst = useCallback(() => setS((p) => ({ ...p, rows: p.rows.slice(DROP), dropped: p.dropped + DROP })), []);
  // rows that were deleted on the server leave the view without a reload
  const removeKeys = useCallback((keys) => setS((p) => ({ ...p, rows: p.rows.filter((x) => !keys.has(x.k)), total: p.total === null ? null : Math.max(0, p.total - keys.size) })), []);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...s, loadMore, retry, dropFirst, removeKeys, reload };
}
