import React from "react";
import Badge from "./Badge.jsx";
import { typeOf } from "./typeMeta.js";
import { connHref, plural } from "./nav.js";

function Tile({ conn, source, status }) {
  const t = typeOf(conn.type);
  const cs = source?.containers;
  const known = cs?.filter((c) => c.count != null) ?? [];
  const records = known.reduce((a, c) => a + c.count, 0);
  return (
    <a href={connHref(conn.id)} className="tile" data-scope={conn.type}>
      <Badge type={conn.type} size="lg" />
      <span className="tile-body">
        <span className="tile-name">{conn.name}</span>
        <span className="tile-meta">
          {cs ? plural(cs.length, t.noun, t.nouns) : " "}
          {cs && known.length > 0 && known.length === cs.length && <span className="faint">{plural(records, "record", "records")}</span>}
        </span>
        <span className={`tile-status ${status}`}>
          <span className={`dot ${status}`} aria-hidden="true" />
          {status === "up" ? "Connected" : status === "down" ? "Unreachable" : "Checking…"}
        </span>
        {status === "down" && source?.error && <span className="tile-err">{source.error}</span>}
      </span>
    </a>
  );
}

export default function Home({ conns, ov, ovErr, statusOf, onAdd, hiddenDefaults = 0, onRestore }) {
  return (
    <div className="page">
      <h1>Your data</h1>
      {conns === null && <p className="note" role="status">Loading…</p>}
      {ovErr && <p className="note bad" role="alert">Could not check connections: {ovErr}</p>}
      {conns && conns.length === 0 && (
        <div className="empty">
          <p>No data connected yet. Add a database to start browsing.</p>
          <div className="empty-actions">
            <button type="button" className="btn primary" onClick={onAdd}>Add data</button>
            {hiddenDefaults > 0 && <button type="button" className="btn" onClick={onRestore}>Restore sample connections</button>}
          </div>
        </div>
      )}
      {conns?.length > 0 && (
        <ul className="tiles">
          {conns.map((c) => <li key={c.id}><Tile conn={c} source={ov?.sources.find((s) => s.id === c.id)} status={statusOf(c.id)} /></li>)}
        </ul>
      )}
      {conns?.length > 0 && hiddenDefaults > 0 && (
        <p className="restore note">{hiddenDefaults === 1 ? "1 sample connection is hidden." : `${hiddenDefaults} sample connections are hidden.`} <button type="button" className="linklike" onClick={onRestore}>Restore sample connections</button></p>
      )}
    </div>
  );
}
