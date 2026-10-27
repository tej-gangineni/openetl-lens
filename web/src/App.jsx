import React, { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar.jsx";
import Home from "./Home.jsx";
import ConnectionView from "./ConnectionView.jsx";
import Highlights from "./Highlights.jsx";
import Logo from "./Logo.jsx";
import { AddConnectionDialog, DeleteConnectionDialog } from "./ConnectionDialogs.jsx";
import { ToastProvider, useToast } from "./Toast.jsx";
import { api } from "./api.js";
import { parseHash, connHref } from "./nav.js";

function Shell() {
  const toast = useToast();
  const mainRef = useRef(null);
  const [route, setRoute] = useState(parseHash);
  const [conns, setConns] = useState(null), [connErr, setConnErr] = useState("");
  const [ov, setOv] = useState(null), [ovErr, setOvErr] = useState("");
  const [adding, setAdding] = useState(false), [deleting, setDeleting] = useState(null);
  const [hiddenDefaults, setHiddenDefaults] = useState(0);
  // the left panel can be closed to give the data the whole width; the choice is remembered
  const [railOpen, setRailOpen] = useState(() => { try { return localStorage.getItem("lens.rail") !== "closed"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("lens.rail", railOpen ? "open" : "closed"); } catch { /* private mode */ } }, [railOpen]);

  useEffect(() => {
    const f = () => setRoute(parseHash());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const loadConns = useCallback(async () => {
    try { const d = await api("/connections"); setConns(d.connections); setHiddenDefaults(d.hiddenDefaults || 0); setConnErr(""); }
    catch (e) { setConnErr(e.message); setConns((c) => c || []); }
  }, []);
  // The overview probes every store, which is slow, so statuses and counts fill in when it arrives.
  const loadOv = useCallback(() => {
    setOvErr("");
    api("/overview").then(setOv).catch((e) => setOvErr(e.message));
  }, []);
  const refresh = useCallback(async () => { await loadConns(); setOv(null); loadOv(); }, [loadConns, loadOv]);
  useEffect(() => { loadConns(); loadOv(); }, [loadConns, loadOv]);

  const cur = route.page === "c" ? conns?.find((c) => c.id === route.id) : null;
  useEffect(() => {
    document.title = cur ? `${cur.name} · OpenETL Lens` : route.page === "highlights" ? "Highlights · OpenETL Lens" : "Your data · OpenETL Lens";
  }, [cur, route.page]);

  const statusOf = useCallback((id) => {
    const s = ov?.sources.find((x) => x.id === id);
    return s ? (s.ok ? "up" : "down") : "unknown";
  }, [ov]);

  const restore = async () => {
    try {
      const d = await api("/connections/restore-defaults", { method: "POST" });
      await refresh();
      toast(d.restored === 1 ? "1 sample connection restored" : `${d.restored} sample connections restored`, "success");
    } catch (e) { toast(e.message, "error"); }
  };
  const onSaved = async (c) => { setAdding(false); await refresh(); location.hash = connHref(c.id); };
  const onDeleted = async () => {
    const name = deleting?.name;
    setDeleting(null); location.hash = "home";
    await refresh();
    toast(`${name} deleted`, "success");
  };

  return (
    <div className="app">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
      <header className="top">
        <div className="top-left">
          <button type="button" className="icon-btn" onClick={() => setRailOpen((o) => !o)} aria-expanded={railOpen} aria-controls="rail"
            aria-label={railOpen ? "Close sidebar" : "Open sidebar"} title={railOpen ? "Close sidebar" : "Open sidebar"}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="3.5" width="15" height="13" rx="3" />
              <path d="M7.5 3.5v13" />
              {railOpen ? <path d="M13.2 8.2 11.4 10l1.8 1.8" /> : <path d="M11.4 8.2 13.2 10l-1.8 1.8" />}
            </svg>
          </button>
          <a href="#home" className="brand" translate="no"><Logo size={26} /><span>OpenETL <b>Lens</b></span></a>
        </div>
        <a href="#highlights" className="top-link" aria-current={route.page === "highlights" ? "page" : undefined}>Highlights</a>
      </header>
      <div className={railOpen ? "shell" : "shell rail-closed"}>
        {railOpen && <Sidebar conns={conns} error={connErr} route={route} statusOf={statusOf} onAdd={() => setAdding(true)} />}
        <main id="main" ref={mainRef} tabIndex={-1} data-scope={cur ? cur.type : undefined} className={cur ? "main scoped" : "main"}>
          {route.page === "home" && <Home conns={conns} ov={ov} ovErr={ovErr} statusOf={statusOf} onAdd={() => setAdding(true)} hiddenDefaults={hiddenDefaults} onRestore={restore} />}
          {route.page === "highlights" && <Highlights />}
          {route.page === "c" && conns === null && <p className="note pad" role="status">Loading…</p>}
          {route.page === "c" && conns && !cur && (
            <div className="page"><h1>Connection not found</h1><p className="muted">There is no connection called <span className="mono" translate="no">{route.id}</span>. Pick one from the list, or <a href="#home">go back to your data</a>.</p></div>
          )}
          {cur && <ConnectionView key={cur.id} conn={cur} route={route} onDelete={setDeleting} />}
        </main>
      </div>
      <AddConnectionDialog open={adding} onClose={() => setAdding(false)} onSaved={onSaved} />
      {deleting && <DeleteConnectionDialog connection={deleting} onClose={() => setDeleting(null)} onDeleted={onDeleted} />}
    </div>
  );
}

export default function App() {
  return <ToastProvider><Shell /></ToastProvider>;
}
