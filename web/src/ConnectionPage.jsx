import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionIcon, Alert, Anchor, Badge, Paper, Box, Breadcrumbs, Button, Checkbox, CloseButton, Code, Flex, Group, Kbd, Menu, Popover,
  ScrollArea, SegmentedControl, Skeleton, Stack, Text, TextInput, Title,
} from "@mantine/core";
import { useDebouncedValue, useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconColumns3, IconDots, IconPlugConnected, IconSearch, IconTrash, IconEraser, IconLock } from "@tabler/icons-react";
import { useApp } from "./AppContext.jsx";
import { api } from "./api.js";
import { typeOf } from "./typeMeta.js";
import { connHref, plural } from "./nav.js";
import { useRows } from "./useRows.js";
import DataGrid from "./DataGrid.jsx";
import RowDrawer from "./RowDrawer.jsx";
import QueryConsole from "./QueryConsole.jsx";
import { confirmEnableDelete, confirmDeleteRows, setDelete } from "./rowActions.js";

const nf = new Intl.NumberFormat("en-US");
const STATUS = { up: ["green", "Connected"], down: ["red", "Not reachable"], unknown: ["gray", "Checking"] };
const DEFAULT_COLS = 8;

function ColumnPicker({ all, picked, onChange }) {
  const shown = picked ?? all.slice(0, DEFAULT_COLS);
  return (
    <Popover position="bottom-end" shadow="md" width={280} trapFocus>
      <Popover.Target>
        <Button variant="default" leftSection={<IconColumns3 size={16} />} disabled={!all.length} aria-label={`Columns, ${shown.length} of ${all.length} shown`}>
          Columns <Badge ml={6} size="sm" variant="light" circle={false}>{shown.length}/{all.length}</Badge>
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={600}>Show columns</Text>
            <Group gap={4}>
              <Button size="compact-xs" variant="subtle" onClick={() => onChange(null)}>First {DEFAULT_COLS}</Button>
              <Button size="compact-xs" variant="subtle" onClick={() => onChange(all)}>All</Button>
            </Group>
          </Group>
          <ScrollArea.Autosize mah={320} type="auto">
            <Checkbox.Group value={shown} onChange={(v) => onChange(all.filter((c) => v.includes(c)))}>
              <Stack gap={6}>{all.map((c) => <Checkbox key={c} value={c} label={c} size="sm" disabled={shown.length === 1 && shown[0] === c} />)}</Stack>
            </Checkbox.Group>
          </ScrollArea.Autosize>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

// The open table of one connection. Keyed by connection and table so every piece of state starts fresh.
function TableView({ conn, table, view, count }) {
  const t = typeOf(conn.type);
  const app = useApp();
  const isRelata = conn.type === "relata";
  const query = isRelata && view === "query";
  const [qInput, setQInput] = useState("");
  const [debounced] = useDebouncedValue(qInput.trim(), 300);
  const q = isRelata ? "" : debounced;
  const [sort, setSort] = useState(null);
  const rows = useRows(conn.id, table, q, !query, sort);
  const [checked, setChecked] = useState(() => new Set());
  const canDelete = !!conn.writable;
  // click a column: ascending, then descending, then back to the stored order
  const onSort = useCallback((col) => setSort((p) => (!p || p.col !== col ? { col, dir: "asc" } : p.dir === "asc" ? { col, dir: "desc" } : null)), []);
  useEffect(() => { setChecked(new Set()); }, [q, sort]);
  const onCheck = useCallback((k) => setChecked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; }), []);
  const onCheckAll = useCallback(() => setChecked((p) => (rows.rows.length && rows.rows.every((x) => p.has(x.k)) ? new Set() : new Set(rows.rows.map((x) => x.k)))), [rows.rows]);
  const deleteChecked = () => {
    const picked = rows.rows.filter((x) => checked.has(x.k));
    confirmDeleteRows({ conn, table, refs: picked.map((x) => x.r.__ref), onDone: () => { rows.removeKeys(new Set(picked.map((x) => x.k))); setChecked(new Set()); app.loadTables(conn.id, { force: true }); } });
  };
  const [picked, setPicked] = useState(null);
  const [open, setOpen] = useState({ item: null, opened: false, cols: null });
  const searchRef = useRef(null);
  useHotkeys([["/", (e) => { e.preventDefault(); searchRef.current?.focus(); }]]);

  const visible = picked ? rows.columns.filter((c) => picked.includes(c)) : rows.columns.slice(0, DEFAULT_COLS);
  const onOpen = useCallback((item, el, cols) => setOpen({ item, opened: true, cols: cols || null }), []);
  const onClose = useCallback(() => setOpen((o) => ({ ...o, opened: false })), []);
  const onGridOpen = useCallback((item) => onOpen(item, null, null), [onOpen]);

  const totalText = rows.total === null ? "" : rows.capped ? `at least ${nf.format(rows.total)} rows` : `${nf.format(rows.total)} ${rows.total === 1 ? "row" : "rows"}`;
  const badgeText = count != null ? `${nf.format(count)} ${count === 1 ? "row" : "rows"}` : totalText;
  const [sc, sl] = STATUS[app.status(conn.id)] || STATUS.unknown;

  const test = async () => {
    const id = `test-${conn.id}`;
    notifications.show({ id, loading: true, message: `Testing ${conn.name}…`, autoClose: false, withCloseButton: false });
    try {
      const d = await api(`/c/${encodeURIComponent(conn.id)}/containers`);
      await app.refresh();
      notifications.update({ id, loading: false, color: "teal", message: `Connected. Found ${plural(d.containers.length, t.noun, t.nouns)}.`, autoClose: 4000, withCloseButton: true });
    } catch (e) {
      await app.refresh();
      notifications.update({ id, loading: false, color: "red", title: "Could not connect", message: e.message, autoClose: 8000, withCloseButton: true });
    }
  };

  return (
    <Flex direction="column" h="calc(100dvh - var(--app-shell-padding, 0px) * 2)" mih={360} gap="sm">
      <Stack gap="xs" flex="0 0 auto">
        <Breadcrumbs separatorMargin="xs">
          <Anchor href="#home" size="sm">Your data</Anchor>
          <Anchor href={connHref(conn.id)} size="sm" translate="no">{conn.name}</Anchor>
          <Text size="sm" c="dimmed" aria-current="page" translate="no">{table}</Text>
        </Breadcrumbs>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
          <Stack gap={4} miw={0}>
            <Group gap="sm" align="center">
              <Title order={2} fz={24} translate="no">{table}</Title>
              {badgeText && <Badge variant="light" color={t.color} size="lg">{badgeText}</Badge>}
              <Badge variant="dot" color={sc} size="lg">{sl}</Badge>
            </Group>
            <Group gap="xs">
              <Code translate="no">{conn.summary}</Code>
            </Group>
          </Stack>
          <Group gap="sm" wrap="nowrap">
            {isRelata && (
              <SegmentedControl
                value={query ? "query" : "browse"}
                onChange={(v) => { location.hash = connHref(conn.id, { table, view: v }); }}
                data={[{ value: "browse", label: "Browse" }, { value: "query", label: "Query" }]}
                aria-label="Relata view"
              />
            )}
            <Menu position="bottom-end" shadow="md" width={210}>
              <Menu.Target>
                <ActionIcon variant="default" size="lg" aria-label={`Actions for ${conn.name}`}><IconDots size={18} /></ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconPlugConnected size={16} />} onClick={test}>Test connection</Menu.Item>
                <Menu.Divider />
                {canDelete
                  ? <Menu.Item leftSection={<IconLock size={16} />} onClick={() => setDelete(conn, false, app.refresh)}>Turn off row deleting</Menu.Item>
                  : <Menu.Item leftSection={<IconEraser size={16} />} onClick={() => confirmEnableDelete(conn, app.refresh)}>Allow deleting rows…</Menu.Item>}
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => app.requestDelete(conn)}>Delete connection</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
        {!query && !isRelata && (
          <Group gap="sm" justify="space-between" wrap="wrap">
            <TextInput
              ref={searchRef}
              flex="1 1 260px" maw={460}
              value={qInput}
              onChange={(e) => setQInput(e.currentTarget.value)}
              placeholder={`Search in ${table}`}
              aria-label={`Search in ${table}`}
              autoComplete="off" spellCheck={false} name="q"
              leftSection={<IconSearch size={16} />}
              rightSectionPointerEvents="all"
              rightSection={qInput ? <CloseButton size="sm" aria-label="Clear search" onClick={() => { setQInput(""); searchRef.current?.focus(); }} /> : <Kbd size="xs" aria-hidden="true">/</Kbd>}
              onKeyDown={(e) => { if (e.key === "Escape" && qInput) { e.stopPropagation(); setQInput(""); } }}
            />
            <Group gap="sm">
              <Text size="sm" c="dimmed" role="status" aria-live="polite">
                {rows.loading && !rows.rows.length ? "Loading…" : q && totalText ? `${totalText} match` : ""}
              </Text>
              <ColumnPicker all={rows.columns} picked={picked} onChange={setPicked} />
            </Group>
          </Group>
        )}
        {!query && isRelata && (
          <Group justify="flex-end"><ColumnPicker all={rows.columns} picked={picked} onChange={setPicked} /></Group>
        )}
      </Stack>
      {!query && canDelete && checked.size > 0 && (
        <Paper withBorder radius="md" px="md" py={6} role="region" aria-label="Selected rows">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm" fw={500}>{nf.format(checked.size)} {checked.size === 1 ? "row" : "rows"} selected</Text>
            <Group gap="xs">
              <Button size="compact-sm" variant="default" onClick={() => setChecked(new Set())}>Clear</Button>
              <Button size="compact-sm" color="red" leftSection={<IconTrash size={14} />} onClick={deleteChecked}>Delete</Button>
            </Group>
          </Group>
        </Paper>
      )}
      <Box flex={1} mih={0}>
        {query ? (
          <QueryConsole conn={conn} table={table} onOpenRow={onOpen} selectedKey={open.opened ? open.item?.k : undefined} />
        ) : (
          <DataGrid
            label={`Rows of ${table}`} items={rows.rows} columns={visible} numeric={rows.numeric} q={q}
            loading={rows.loading} error={rows.error} done={rows.done} dropped={rows.dropped} resetKey={`${conn.id}|${table}|${q}|${sort?.col}|${sort?.dir}`}
            sort={sort} onSort={onSort} sortable={rows.sortable}
            checked={canDelete ? checked : undefined} onCheck={onCheck} onCheckAll={onCheckAll}
            onLoadMore={rows.loadMore} onRetry={rows.retry} onDropFirst={rows.dropFirst} onOpen={onGridOpen}
            selectedKey={open.opened ? open.item?.k : undefined}
          />
        )}
      </Box>
      <RowDrawer opened={open.opened} onClose={onClose} conn={conn} container={table} row={open.item?.r} columns={open.cols || visible} />
    </Flex>
  );
}

export default function ConnectionPage({ conn, route }) {
  const app = useApp();
  const t = typeOf(conn.type);
  const tables = app.getTables(conn.id);
  const { loadTables } = app;
  useEffect(() => { loadTables(conn.id); }, [conn.id, loadTables]);

  // With no table in the URL the shell redirects to the last used or the first table; until then we show a skeleton.
  const first = tables.items?.[0]?.name;

  const frame = (children) => <Stack gap="md" h="calc(100dvh - var(--app-shell-padding, 0px) * 2)" mih={360}>{children}</Stack>;
  if (tables.status === "error") {
    return frame(
      <Alert color="red" icon={<IconAlertCircle size={18} />} title={`Could not list the ${t.nouns} of ${conn.name}`}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text size="sm">{tables.error}</Text>
          <Button size="compact-sm" variant="light" color="red" onClick={() => loadTables(conn.id, { force: true })}>Retry</Button>
        </Group>
      </Alert>,
    );
  }
  if (tables.status !== "ok" || !route.table) {
    if (tables.status === "ok" && !first) {
      return frame(
        <Stack gap="xs" align="flex-start">
          <Title order={2} fz={24} translate="no">{conn.name}</Title>
          <Text c="dimmed">No {t.nouns} found here yet. Add some data to it, then test the connection again.</Text>
          <Button variant="default" leftSection={<IconPlugConnected size={16} />} onClick={() => app.refresh()}>Test connection</Button>
        </Stack>,
      );
    }
    return frame(
      <Stack gap="md" aria-busy="true" aria-label="Loading">
        <Skeleton h={14} w={220} /><Skeleton h={30} w={320} /><Skeleton h={14} w={260} /><Skeleton h={36} w={420} />
        <Stack gap={8}>{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} h={22} />)}</Stack>
      </Stack>,
    );
  }
  const info = tables.items.find((x) => x.name === route.table);
  if (!info) {
    return frame(
      <Alert color="yellow" icon={<IconAlertCircle size={18} />} title={`There is no ${t.noun} called "${route.table}"`}>
        <Anchor href={connHref(conn.id, { table: first })} size="sm">Open {first}</Anchor>
      </Alert>,
    );
  }
  return <TableView key={`${conn.id}|${route.table}`} conn={conn} table={route.table} view={route.view} count={info.count} />;
}
