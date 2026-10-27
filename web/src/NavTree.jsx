import React from "react";
import { Anchor, Badge, Box, Indicator, NavLink, Skeleton, Stack, Text, VisuallyHidden } from "@mantine/core";
import { IconTable } from "@tabler/icons-react";
import TypeIcon from "./TypeIcon.jsx";
import { typeOf } from "./typeMeta.js";
import { connHref } from "./nav.js";
import { fmt } from "./api.js";
import { useApp } from "./AppContext.jsx";

const DOT = { up: "green", down: "red", unknown: "gray" };
const STATUS_TEXT = { up: "connected", down: "unreachable", unknown: "checking connection" };

function Tables({ conn, route, onNavigate }) {
  const { getTables, loadTables } = useApp();
  const t = getTables(conn.id);
  const nouns = typeOf(conn.type).nouns;
  if (t.status === "idle" || (t.status === "loading" && t.items.length === 0)) {
    return (
      <Stack gap={6} py={4} aria-busy="true" aria-label={`Loading ${nouns}`}>
        <Skeleton h={24} /><Skeleton h={24} w="80%" /><Skeleton h={24} w="90%" />
      </Stack>
    );
  }
  if (t.status === "error") {
    return (
      <Box py={4} px="xs">
        <Text size="xs" c="red" role="alert" lineClamp={3}>Could not list {nouns}. {t.error}</Text>
        <Anchor component="button" type="button" size="xs" onClick={() => loadTables(conn.id, { force: true })}>Try again</Anchor>
      </Box>
    );
  }
  if (t.items.length === 0) return <Text size="xs" c="dimmed" py={4} px="xs">No {nouns} yet</Text>;
  return t.items.map((it) => (
    <NavLink
      key={it.name}
      href={connHref(conn.id, { table: it.name })}
      onClick={onNavigate}
      active={route.id === conn.id && route.table === it.name}
      label={<Text size="sm" truncate="end" title={it.name}>{it.name}</Text>}
      leftSection={<IconTable size={15} stroke={1.6} aria-hidden="true" />}
      rightSection={typeof it.count === "number" ? <Badge size="sm" variant="light" color="gray" ff="monospace">{fmt(it.count)}</Badge> : null}
      variant="light"
      py={4}
    />
  ));
}

export default function NavTree({ route, onNavigate }) {
  const { conns, status } = useApp();
  if (conns === null) {
    return (
      <Stack gap={8} aria-busy="true" aria-label="Loading your data">
        <Skeleton h={34} /><Skeleton h={34} /><Skeleton h={34} />
      </Stack>
    );
  }
  if (conns.length === 0) return <Text size="sm" c="dimmed" px="xs">Nothing connected yet. Use Add data to start.</Text>;
  return (
    <Box component="nav" aria-label="Your data">
      {conns.map((c) => {
        const open = route.page === "c" && route.id === c.id;
        const s = status(c.id);
        return (
          <NavLink
            key={c.id}
            href={connHref(c.id)}
            onClick={onNavigate}
            opened={open}
            active={open && !route.table && route.view !== "query"}
            variant="light"
            color={typeOf(c.type).color}
            label={<Text size="sm" fw={500} truncate="end">{c.name}<VisuallyHidden>, {STATUS_TEXT[s]}</VisuallyHidden></Text>}
            leftSection={
              <Indicator color={DOT[s]} size={9} offset={3} position="bottom-end" withBorder processing={s === "unknown"} disabled={false}>
                <TypeIcon type={c.type} size={28} />
              </Indicator>
            }
            childrenOffset={22}
          >
            {open && <Tables conn={c} route={route} onNavigate={onNavigate} />}
          </NavLink>
        );
      })}
    </Box>
  );
}
