import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";

const IDLE = { status: "idle", items: [], error: null };

// Loads the connections, their status (slow, from /api/overview) and the tables of the connections that were opened.
export function useConnections() {
  const [conns, setConns] = useState(null);
  const [hiddenDefaults, setHiddenDefaults] = useState(0);
  const [overview, setOverview] = useState(null);
  const [tables, setTables] = useState({});
  const tablesRef = useRef({});
  const generation = useRef(0);

  const setTable = useCallback((id, value) => {
    tablesRef.current = { ...tablesRef.current, [id]: value };
    setTables(tablesRef.current);
  }, []);

  const loadConns = useCallback(async () => {
    try {
      const d = await api("/connections");
      setConns(d.connections);
      setHiddenDefaults(d.hiddenDefaults || 0);
    } catch {
      setConns((c) => c || []);
    }
  }, []);

  const loadOverview = useCallback(() => {
    const mine = ++generation.current;
    api("/overview").then((d) => { if (mine === generation.current) setOverview(d); }).catch(() => {});
  }, []);

  const loadTables = useCallback((id, { force } = {}) => {
    const cur = tablesRef.current[id];
    if (!force && cur && (cur.status === "ok" || cur.status === "loading")) return;
    // a refresh of a list that is already on screen happens quietly: the old list stays until the new one arrives
    const quiet = cur?.status === "ok";
    if (!quiet) setTable(id, { status: "loading", items: cur?.items || [], error: null });
    api(`/c/${encodeURIComponent(id)}/containers`)
      .then((d) => setTable(id, { status: "ok", items: d.containers || [], error: null }))
      .catch((e) => { if (!quiet) setTable(id, { status: "error", items: [], error: e.message }); });
  }, [setTable]);

  const refresh = useCallback(async () => {
    setOverview(null);
    loadOverview();
    await loadConns();
    Object.keys(tablesRef.current).forEach((id) => loadTables(id, { force: true }));
  }, [loadConns, loadOverview, loadTables]);

  useEffect(() => { loadConns(); loadOverview(); }, [loadConns, loadOverview]);

  // Until the overview arrives, a connection whose tables loaded is up, and one whose tables failed is down.
  const status = useCallback((id) => {
    const s = overview?.sources?.find((x) => x.id === id);
    if (s) return s.ok ? "up" : "down";
    const t = tables[id]?.status;
    return t === "ok" ? "up" : t === "error" ? "down" : "unknown";
  }, [overview, tables]);

  const getTables = useCallback((id) => tables[id] || IDLE, [tables]);

  return useMemo(
    () => ({ conns, hiddenDefaults, status, getTables, loadTables, refresh }),
    [conns, hiddenDefaults, status, getTables, loadTables, refresh],
  );
}
