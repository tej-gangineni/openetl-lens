import React from "react";
import Badge from "./Badge.jsx";
import { connHref } from "./nav.js";

const STATUS = { up: "Connected", down: "Unreachable", unknown: "Checking" };

export default function Sidebar({ conns, error, route, statusOf, onAdd }) {
  return (
    <nav className="rail" id="rail" aria-label="Your data">
      <h2 className="rail-title">Your data</h2>
      <button type="button" className="btn primary rail-add" onClick={onAdd}>Add data</button>
      {conns === null && <p className="note">Loading…</p>}
      {error && <p className="note bad" role="alert">{error}</p>}
      <ul className="rail-list">
        {conns?.map((c) => {
          const s = statusOf(c.id), on = route.page === "c" && route.id === c.id;
          return (
            <li key={c.id}>
              <a href={connHref(c.id)} className="rail-item" data-scope={c.type} title={c.summary} aria-current={on ? "page" : undefined}>
                <Badge type={c.type} size="sm" />
                <span className="rail-name">{c.name}</span>
                <span className={`dot ${s}`} role="img" aria-label={STATUS[s]} />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
