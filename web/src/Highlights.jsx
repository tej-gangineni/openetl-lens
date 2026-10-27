import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { Bars } from "./charts.jsx";

export default function Highlights() {
  const [ins, setIns] = useState(null), [err, setErr] = useState("");
  useEffect(() => {
    const c = new AbortController();
    api("/insights", { signal: c.signal }).then(setIns).catch((e) => { if (e.name !== "AbortError") setErr(e.message); });
    return () => c.abort();
  }, []);
  const rd = ins?.readings;
  return (
    <div className="page">
      <h1>Highlights</h1>
      <p className="muted lede">Counts worked out live from the sample stores.</p>
      {err && <p className="bad" role="alert">{err}</p>}
      {!ins && !err && <p className="note" role="status"><span className="spin" aria-hidden="true" /> Computing…</p>}
      <div className="charts-grid">
        <Bars scope="postgres" title="Incidents per month" note="PostgreSQL" data={ins?.incidentsByMonth?.error ? ins.incidentsByMonth : ins?.incidentsByMonth?.map((r) => ({ label: r.month, value: r.incidents }))} />
        <Bars scope="postgres" title="Customers affected per month" note="PostgreSQL" data={ins?.incidentsByMonth?.error ? ins.incidentsByMonth : ins?.incidentsByMonth?.map((r) => ({ label: r.month, value: r.customers }))} />
        <Bars scope="mongodb" title="Tickets by category" note="MongoDB" data={ins?.tickets?.error ? ins.tickets : ins?.tickets?.category} />
        <Bars scope="mongodb" title="Tickets by status" note="MongoDB" data={ins?.tickets?.error ? ins.tickets : ins?.tickets?.status} />
        <Bars scope="clickhouse" title="Tower readings" note="ClickHouse" data={rd?.error ? rd : rd && [{ label: "ok", value: rd.ok }, { label: "degraded", value: rd.degraded }]} />
        <Bars scope="elasticsearch" title="Pages that mention a topic" note="Elasticsearch" data={ins?.pagesByTopic} />
        <Bars scope="qdrant" title="Field notes by site" note="Qdrant" data={ins?.notesBySite} />
      </div>
    </div>
  );
}
