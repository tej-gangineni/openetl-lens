import React, { useEffect, useRef, useState } from "react";
import { Line, parseMdTable } from "./charts.jsx";
import { api, qs, cellText } from "./api.js";

const COLORS = ["var(--accent)", "var(--warn)", "var(--bad)", "var(--ok)"];
const isCut = (v) => typeof v === "string" && v.endsWith("…") && v.length >= 1990;

// A parsed CSV table: one line chart per numeric column (first four), then the grid.
function TableView({ table }) {
  const first = table.head[0];
  const numeric = table.head.slice(1).filter((h) => table.rows.length && table.rows.every((r) => r[h] !== "" && Number.isFinite(Number(r[h])))).slice(0, 4);
  const shown = table.rows.slice(0, 500);
  return (
    <>
      <p className="faint small">This field holds a table with {table.rows.length.toLocaleString("en-US")} rows.</p>
      {numeric.length > 0 && (
        <div className="charts">
          {numeric.map((h, i) => <Line key={h} title={h} color={COLORS[i % COLORS.length]} points={table.rows.map((r) => ({ x: String(r[first] ?? "").slice(-8), y: Number(r[h]) }))} />)}
        </div>
      )}
      <div className="scroll tall">
        <table><thead><tr>{table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{shown.map((r, i) => <tr key={i}>{table.head.map((h) => <td key={h}>{r[h]}</td>)}</tr>)}</tbody></table>
      </div>
      {table.rows.length > shown.length && <p className="faint small">Showing the first {shown.length} rows.</p>}
    </>
  );
}

export default function Detail({ row, columns, conn, container, onClose }) {
  const closeBtn = useRef(null), panel = useRef(null);
  const ref = row.__ref;
  const cut = Object.values(row).some(isCut);
  const [full, setFull] = useState(null);
  const [state, setState] = useState(cut && ref && conn ? "loading" : "idle"); // idle | loading | full | failed

  useEffect(() => {
    if (!(cut && ref && conn)) return;
    const c = new AbortController();
    api(`/c/${encodeURIComponent(conn.id)}/row?${qs({ container, ref })}`, { signal: c.signal })
      .then((d) => { if (d?.row) { setFull(d.row); setState("full"); } else setState("failed"); })
      .catch((e) => { if (e.name !== "AbortError") setState("failed"); });
    return () => c.abort();
  }, [cut, ref, conn, container]);

  useEffect(() => {
    closeBtn.current?.focus();
    const k = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return; // keep focus inside the drawer
      const f = panel.current.querySelectorAll("button, summary, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const data = full || row;
  const keys = Object.keys(data).filter((k) => k !== "__ref");
  const clean = Object.fromEntries(keys.map((k) => [k, data[k]]));
  const title = cellText(data[columns[0]]).slice(0, 80) || container || "Record";
  return (
    <div className="scrim" onClick={onClose}>
      <aside className="drawer" ref={panel} role="dialog" aria-modal="true" aria-label="Record" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2 className="clamp2" translate="no">{title}</h2>
          <button type="button" className="icon-btn" ref={closeBtn} onClick={onClose} aria-label="Close record">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" /></svg>
          </button>
        </header>
        <div className="drawer-body">
          <p className="drawer-note" role="status" aria-live="polite">
            {state === "loading" && <><span className="spin" aria-hidden="true" /> Loading the full record…</>}
            {state === "failed" && "Some long values are cut at 2,000 characters. The full record could not be loaded."}
            {state === "idle" && cut && "Some long values are cut at 2,000 characters."}
          </p>
          <dl className="fields">
            {keys.map((k) => {
              const text = cellText(data[k]), table = typeof data[k] === "string" ? parseMdTable(data[k]) : null;
              return (
                <div key={k} className="field">
                  <dt>{k}</dt>
                  <dd>{table ? <TableView table={table} /> : text.length > 120 || text.includes("\n") ? <pre className="text">{text}</pre> : text ? <span>{text}</span> : <span className="faint">Empty</span>}</dd>
                </div>
              );
            })}
          </dl>
          <details className="raw"><summary>Show as JSON</summary><pre className="text">{JSON.stringify(clean, null, 2)}</pre></details>
        </div>
      </aside>
    </div>
  );
}
