import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, qs, fmt, cellText, isAbort } from "./api.js";
import Detail from "./Detail.jsx";

const PAGE = 100;       // rows per request
const MAX_ROWS = 3000;  // rows mounted at once
const DROP = 1000;      // rows that leave the view when the user asks for more
const MAX_COLS = 8;
// Which columns to show first: ids, then columns people read, then the rest, with internal metadata last.
const READABLE = /^(text|title|name|subject|body|content|description|summary|message|source_filename|category|status|priority|region)$/i;
const INTERNAL = /(metadata|sha256|job_run_id|schema_version|extraction_method|section_path_tier|sequence_index|source_path|source_uri|source_media_type|^__)/i;
const rank = (k) => (/^_?id$/i.test(k) ? 0 : READABLE.test(k) ? 1 : INTERNAL.test(k) ? 3 : 2);
const ID_COL = /(^|_)id$|^_id$|uuid|^ref$/i;

const Row = React.memo(function Row({ item, cols, numeric, onOpen, selected }) {
  const r = item.r;
  return (
    <div className="grow body" role="row" tabIndex={0} aria-selected={selected || undefined} data-selected={selected || undefined}
      onClick={(e) => onOpen(item, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(item, e.currentTarget); }
        else if (e.key === "ArrowDown") { e.preventDefault(); e.currentTarget.nextElementSibling?.focus?.(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); e.currentTarget.previousElementSibling?.focus?.(); }
      }}>
      {cols.map((c) => {
        const v = r[c], empty = v === null || v === undefined || v === "";
        return (
          <div key={c} role="cell" className={`cell${numeric.has(c) ? " num" : ""}${ID_COL.test(c) ? " mono" : ""}`}>
            {empty ? <span className="faint">&mdash;</span> : <span className="clamp2">{cellText(v)}</span>}
          </div>
        );
      })}
    </div>
  );
});

export default function Browser({ conn, container }) {
  const isRelata = conn.type === "relata";
  const [qInput, setQInput] = useState(""), [q, setQ] = useState("");
  const [rows, setRows] = useState([]), [dropped, setDropped] = useState(0), [columns, setColumns] = useState([]);
  const [numeric, setNumeric] = useState(() => new Set());
  const [total, setTotal] = useState(null), [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState(false);
  const [open, setOpen] = useState(null);
  const ctrl = useRef(null), gen = useRef(0), inflight = useRef(false), cursor = useRef(null), seq = useRef(0);
  const scroller = useRef(null), sentinel = useRef(null), lastFocus = useRef(null);

  // debounce the search box (300 ms)
  useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 300); return () => clearTimeout(t); }, [qInput]);

  // one request at a time; stale ones are aborted by the reset effect below
  const fetchPage = useCallback(async (query) => {
    if (inflight.current) return;
    inflight.current = true; setLoading(true);
    const my = gen.current, c = new AbortController(); ctrl.current = c;
    try {
      const first = !cursor.current;
      const d = await api(`/c/${encodeURIComponent(conn.id)}/items?${qs({ container, q: isRelata ? "" : query, limit: PAGE, ...(cursor.current ? { cursor: cursor.current } : {}) })}`, { signal: c.signal });
      if (my !== gen.current) return;
      cursor.current = d.next ?? null;
      setRows((p) => p.concat(d.rows.map((r) => ({ k: ++seq.current, r }))));
      setColumns((p) => { const out = p.slice(); const incoming = p.length ? d.columns || [] : [...(d.columns || [])].sort((a, b) => rank(a) - rank(b)); for (const k of incoming) if (out.length < MAX_COLS && !out.includes(k)) out.push(k); return out; });
      if (first) {
        const n = new Set();
        for (const k of d.columns || []) {
          const vals = d.rows.map((r) => r[k]).filter((v) => v !== null && v !== undefined);
          if (vals.length && vals.every((v) => typeof v === "number")) n.add(k);
        }
        setNumeric(n);
      }
      setTotal(d.total ?? null); setCapped(!!d.totalCapped);
      if (!d.next) setDone(true);
    } catch (e) {
      if (my === gen.current && !isAbort(e)) setErr(e.message);
    } finally {
      if (my === gen.current) { inflight.current = false; setLoading(false); }
    }
  }, [conn.id, container, isRelata]);

  // the search changed (or first mount): cancel, clear, load the first page
  useEffect(() => {
    ctrl.current?.abort(); gen.current++; inflight.current = false; cursor.current = null;
    setRows([]); setDropped(0); setColumns([]); setTotal(null); setCapped(false); setDone(false); setErr(""); setOpen(null);
    if (scroller.current) scroller.current.scrollTop = 0;
    fetchPage(q);
    return () => { ctrl.current?.abort(); };
  }, [q, fetchPage]);

  const paused = rows.length >= MAX_ROWS;
  // sentinel: a fresh observer after every change fires at once, so a short page keeps loading until the view is full
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || paused || loading || err || !rows.length) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) fetchPage(q); }, { root: scroller.current, rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q, done, paused, loading, err, rows.length, fetchPage]);

  const loadNext = () => {
    setRows((p) => p.slice(DROP)); setDropped((d) => d + DROP);
    if (scroller.current) scroller.current.scrollTop = 0;
  };
  const retry = () => { setErr(""); fetchPage(q); };
  const onOpen = useCallback((item, el) => { lastFocus.current = el; setOpen(item); }, []);
  const onClose = useCallback(() => { setOpen(null); lastFocus.current?.focus?.({ preventScroll: true }); }, []);

  const totalText = total === null ? "" : capped ? `At least ${fmt(total)} rows` : `${fmt(total)} ${total === 1 ? "row" : "rows"}`;
  const style = { "--n": Math.max(1, columns.length) };
  return (
    <div className="grid-wrap">
      <div className="toolbar">
        {!isRelata && (
          <input type="search" name="q" autoComplete="off" spellCheck={false} placeholder={`Search in ${container}…`} aria-label={`Search in ${container}`}
            value={qInput} onChange={(e) => setQInput(e.target.value)} />
        )}
        <span className="count" role="status" aria-live="polite">
          {loading && !rows.length ? <><span className="spin" aria-hidden="true" /> Loading…</> : totalText}
        </span>
      </div>
      <div className="rows" ref={scroller} style={style} role="table" aria-label={`Rows of ${container}`} aria-rowcount={total ?? undefined}>
        <div className="inner">
          <div className="grow head" role="row">{columns.map((c) => <div key={c} role="columnheader" className={`cell${numeric.has(c) ? " num" : ""}`} title={c}>{c}</div>)}</div>
          {rows.map((it) => <Row key={it.k} item={it} cols={columns} numeric={numeric} onOpen={onOpen} selected={open?.k === it.k} />)}
          {!loading && !err && !rows.length && <p className="empty-note">{q ? <>No records match &ldquo;{q}&rdquo;. Try a shorter word.</> : "This one is empty."}</p>}
          <div ref={sentinel} className="sentinel" aria-hidden="true" />
        </div>
      </div>
      <div className="foot">
        {rows.length > 0 && <span>Rows {fmt(dropped + 1)} to {fmt(dropped + rows.length)}{done ? ", the end" : ""}</span>}
        {loading && rows.length > 0 && <span role="status"><span className="spin" aria-hidden="true" /> Loading more…</span>}
        {err && <><span className="bad" role="alert">{err}</span><button type="button" className="btn sm" onClick={retry}>Try again</button></>}
        {paused && !done && <button type="button" className="btn sm" onClick={loadNext}>Load the next 1,000 (the first 1,000 leave the view)</button>}
      </div>
      {open && <Detail conn={conn} container={container} row={open.r} columns={columns} onClose={onClose} />}
    </div>
  );
}
