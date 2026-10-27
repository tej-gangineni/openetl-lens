import React, { useMemo } from "react";
import { Spotlight } from "@mantine/spotlight";
import { IconChartBar, IconHome, IconPlus, IconSearch, IconTable } from "@tabler/icons-react";
import TypeIcon from "./TypeIcon.jsx";
import { typeOf } from "./typeMeta.js";
import { connHref } from "./nav.js";
import { useApp } from "./AppContext.jsx";

const go = (hash) => () => { location.hash = hash; };

// The command palette (Ctrl or Cmd + K): Add data, Highlights, every connection and the tables of the open connection.
export default function SearchPalette({ route }) {
  const { conns, getTables, openAdd } = useApp();
  const actions = useMemo(() => {
    const list = [
      { group: "Go to", actions: [
        { id: "add", label: "Add data", description: "Connect a database", leftSection: <IconPlus size={22} stroke={1.6} />, onClick: openAdd, keywords: ["connect", "new", "database"] },
        { id: "home", label: "Your data", description: "All connections", leftSection: <IconHome size={22} stroke={1.6} />, onClick: go("#home") },
        { id: "highlights", label: "Highlights", description: "Charts from the sample data", leftSection: <IconChartBar size={22} stroke={1.6} />, onClick: go("#highlights") },
      ] },
    ];
    const all = conns || [];
    if (all.length) {
      list.push({ group: "Connections", actions: all.map((c) => ({
        id: `c:${c.id}`, label: c.name, description: c.summary, keywords: [typeOf(c.type).label],
        leftSection: <TypeIcon type={c.type} size={26} />, onClick: go(connHref(c.id)),
      })) });
    }
    const open = route.page === "c" ? all.find((c) => c.id === route.id) : null;
    const items = open ? getTables(open.id).items : [];
    if (open && items.length) {
      list.push({ group: `${typeOf(open.type).nouns[0].toUpperCase()}${typeOf(open.type).nouns.slice(1)} in ${open.name}`, actions: items.map((t) => ({
        id: `t:${open.id}:${t.name}`, label: t.name, description: typeof t.count === "number" ? `${t.count.toLocaleString("en-US")} records` : undefined,
        leftSection: <IconTable size={22} stroke={1.6} />, onClick: go(connHref(open.id, { table: t.name })),
      })) });
    }
    return list;
  }, [conns, getTables, openAdd, route.page, route.id]);

  return (
    <Spotlight
      actions={actions}
      shortcut="mod + K"
      highlightQuery
      limit={12}
      scrollable
      maxHeight={420}
      nothingFound="Nothing matches. Try a connection or table name."
      searchProps={{ leftSection: <IconSearch size={20} stroke={1.6} />, placeholder: "Search connections and tables…", "aria-label": "Search connections and tables" }}
    />
  );
}
