import React, { useEffect, useRef, useState } from "react";
import { postJson, fmt, cellText, isAbort } from "./api.js";
import Detail from "./Detail.jsx";

export default function Sql({ conn, table }) {
  const T = table || "DocumentChunk";
  const examples = [
    ["Count the rows", `SELECT COUNT(*) FROM ${T}`],
    ["First 20 rows", `SELECT * FROM ${T} LIMIT 20`],
    ["Search by meaning and words", `HYBRID_SEARCH FROM ${T} QUERY 'your words' LIMIT 5`],
  ];
  const [sql, setSql] = useState(examples[1][1]), [res, setRes] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [open, setOpen] = useState(null);
  const ctrl = useRef(null), lastFocus = useRef(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  const run = async () => {
    ctrl.current?.abort(); const c = new AbortController(); ctrl.current = c;
    setBusy(true); setErr(""); setRes(null);
    try { setRes(await postJson(`/c/${encodeURIComponent(conn.id)}/query`, { sql }, c.signal)); }
    catch (e) { if (!isAbort(e)) setErr(e.message); } finally { if (ctrl.current === c) setBusy(false); }
  };
  const cols = res?.columns?.slice(0, 8) || [];
  const openRow = (r, el) => { lastFocus.current = el; setOpen(r); };
  const close = () => { setOpen(null); lastFocus.current?.focus?.({ preventScroll: true }); };
  return (
    <div className="sql">
      <div className="sql-bar">
        <label htmlFor="sql-text" className="sr">Query</label>
        <textarea id="sql-text" name="sql" className="mono" value={sql} onChange={(e) => setSql(e.target.value)} rows={4} spellCheck={false} autoComplete="off"
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && run()} />
        <div className="sql-actions">
          <button type="button" className="btn primary" onClick={run} disabled={busy}>{busy ? "Running…" : "Run query"}</button>
          <span className="faint small">Only SELECT and HYBRID_SEARCH run, so nothing can change. Press Ctrl or ⌘&nbsp;Enter to run.</span>
        </div>
        <div className="chips" role="group" aria-label="Examples">
          {examples.map(([label, s]) => <button type="button" key={label} className="chip" onClick={() => setSql(s)}>{label}</button>)}
        </div>
      </div>
      <p className="count" role="status" aria-live="polite">
        {busy && <><span className="spin" aria-hidden="true" /> Running…</>}
        {res && <>{fmt(res.rows.length)} {res.rows.length === 1 ? "row" : "rows"}{res.ms != null ? ` in ${res.ms} ms` : ""}{res.columns.length > 8 ? ". Showing 8 columns, open a row for all." : ""}</>}
      </p>
      {err && <p className="bad pad-x" role="alert">{err}</p>}
      {res && !res.rows.length && <p className="empty-note">The query ran and returned no rows.</p>}
      {res?.rows.length > 0 && (
        <div className="scroll sql-res">
          <table><thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{res.rows.map((r, i) => (
              <tr key={i} className="click" tabIndex={0} onClick={(e) => openRow(r, e.currentTarget)} onKeyDown={(e) => { if (e.key === "Enter") openRow(r, e.currentTarget); }}>
                {cols.map((c) => <td key={c}><span className="clamp2">{cellText(r[c])}</span></td>)}
              </tr>))}</tbody></table>
        </div>
      )}
      {open && <Detail row={open} columns={cols} onClose={close} />}
    </div>
  );
}
