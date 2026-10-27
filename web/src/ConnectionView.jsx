import React, { useCallback, useEffect, useRef, useState } from "react";
import Badge from "./Badge.jsx";
import Browser from "./Browser.jsx";
import Sql from "./Sql.jsx";
import { api, fmt, isAbort } from "./api.js";
import { typeOf } from "./typeMeta.js";
import { connHref, plural, capital } from "./nav.js";

export default function ConnectionView({ conn, route, onDelete }) {
  const t = typeOf(conn.type);
  const isRelata = conn.type === "relata";
  const view = isRelata && route.view === "query" ? "query" : "browse";
  const [containers, setContainers] = useState(null);
  const [check, setCheck] = useState({ state: "checking", text: "Checking…" });
  const ctrl = useRef(null);

  const load = useCallback(() => {
    ctrl.current?.abort();
    const c = new AbortController(); ctrl.current = c;
    setCheck({ state: "checking", text: "Checking…" });
    api(`/c/${encodeURIComponent(conn.id)}/containers`, { signal: c.signal })
      .then((d) => {
        setContainers(d.containers);
        setCheck({ state: "ok", text: `Connected. Found ${plural(d.containers.length, t.noun, t.nouns)}.` });
      })
      .catch((e) => {
        if (isAbort(e)) return;
        setContainers((p) => p || []);
        setCheck({ state: "bad", text: e.message });
      });
  }, [conn.id, t.noun, t.nouns]);
  useEffect(() => { load(); return () => ctrl.current?.abort(); }, [load]);

  const cur = containers?.find((c) => c.name === route.table)?.name ?? containers?.[0]?.name ?? null;

  return (
    <div className="cv">
      <header className="cv-head">
        <Badge type={conn.type} size="lg" />
        <div className="cv-id">
          <h1 translate="no">{conn.name}</h1>
          <p className="cv-sum mono" translate="no">{conn.summary}</p>
          <p className={`cv-status ${check.state}`} role="status" aria-live="polite">
            <span className={`dot ${check.state === "ok" ? "up" : check.state === "bad" ? "down" : "unknown"}`} aria-hidden="true" />
            {check.text}
          </p>
        </div>
        <div className="cv-actions">
          <button type="button" className="btn" onClick={load} disabled={check.state === "checking"}>Test</button>
          <button type="button" className="btn danger" onClick={() => onDelete(conn)}>Delete</button>
        </div>
      </header>
      {isRelata && (
        <nav className="seg" aria-label="Relata views">
          {[["browse", "Browse"], ["query", "Query"]].map(([id, label]) => (
            <a key={id} href={connHref(conn.id, { table: cur, view: id })} aria-current={view === id ? "page" : undefined}>{label}</a>
          ))}
        </nav>
      )}
      <div className="cv-body">
        {view === "browse" && (
          <nav className="tables" aria-label={capital(t.nouns)}>
            <h2 className="tables-title">{capital(t.nouns)}</h2>
            {containers === null && <p className="note">Loading…</p>}
            {containers?.length === 0 && check.state !== "bad" && <p className="note">Nothing here yet.</p>}
            <ul>
              {containers?.map((c) => (
                <li key={c.name}>
                  <a href={connHref(conn.id, { table: c.name })} className="table-item" aria-current={c.name === cur ? "page" : undefined}>
                    <span className="table-name" title={c.name}>{c.name}</span>
                    {c.count != null && <span className="table-count">{fmt(c.count)}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <section className="cv-main" aria-label={view === "query" ? "Query" : cur ? `Records in ${cur}` : "Records"}>
          {view === "query" && <Sql conn={conn} table={cur} />}
          {view === "browse" && cur && <Browser key={cur} conn={conn} container={cur} />}
          {view === "browse" && containers && !cur && (
            <p className="empty-note">{check.state === "bad" ? <>Could not read this connection. {check.text} Check the details and press Test.</> : `This connection has no ${t.nouns} to show.`}</p>
          )}
        </section>
      </div>
    </div>
  );
}
