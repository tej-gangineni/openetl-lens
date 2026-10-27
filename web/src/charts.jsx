import React from "react";
import { fmt } from "./api.js";

export function Bars({ title, note, data, scope, unit = "" }) {
  if (!data || data.error) return <section className="chart" data-scope={scope}><h2>{title}</h2><p className="faint small" role={data?.error ? "alert" : undefined}>{data?.error || "Loading…"}</p></section>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <section className="chart" data-scope={scope}>
      <h2>{title}</h2>
      {note && <p className="faint small">{note}</p>}
      <div className="bars">
        {data.map((d) => (
          <div className="bar-row" key={d.label}>
            <span className="bar-label" title={d.label}>{d.label}</span>
            <span className="bar-track"><i style={{ width: `${(100 * d.value) / max}%` }} /></span>
            <span className="bar-val">{fmt(d.value)}{unit}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// A small line chart. points: [{x:label, y:number}]
export function Line({ title, points, color = "var(--accent)" }) {
  const W = 360, H = 120, P = 22;
  if (!points.length) return null;
  const ys = points.map((p) => p.y), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const x = (i) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1);
  const y = (v) => H - P - ((v - lo) / span) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  return (
    <figure className="line">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--line)" />
        <path d={d} fill="none" stroke={color} strokeWidth="2" />
        <text x={P} y={12} className="axis">{hi}</text>
        <text x={P} y={H - 6} className="axis">{lo}</text>
        <text x={W - P} y={H - 6} className="axis" textAnchor="end">{points[points.length - 1].x}</text>
        <text x={P + 26} y={H - 6} className="axis">{points[0].x}</text>
      </svg>
    </figure>
  );
}

// Parse a markdown table (as OpenETL stores a CSV) into rows of objects.
export function parseMdTable(text) {
  const lines = String(text || "").split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 3) return null;
  const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const head = cells(lines[0]);
  return { head, rows: lines.slice(2).map((l) => Object.fromEntries(cells(l).map((c, i) => [head[i], c]))) };
}
