import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Flex, Group, Kbd, Stack, Text, Textarea } from "@mantine/core";
import { IconAlertCircle, IconPlayerPlay } from "@tabler/icons-react";
import { postJson, isAbort } from "./api.js";
import DataGrid from "./DataGrid.jsx";
import { rankColumns } from "./useRows.js";

const nf = new Intl.NumberFormat("en-US");
const noop = () => {};

// The Relata query console: one SELECT or HYBRID_SEARCH, results in a table.
export default function QueryConsole({ conn, table, onOpenRow, selectedKey }) {
  const T = table || "DocumentChunk";
  const examples = useMemo(() => [
    ["Count the rows", `SELECT COUNT(*) FROM ${T}`],
    ["First 20 rows", `SELECT * FROM ${T} LIMIT 20`],
    ["Search by meaning and words", `HYBRID_SEARCH FROM ${T} QUERY 'your words' LIMIT 5`],
  ], [T]);
  const [sql, setSql] = useState(examples[1][1]);
  const [res, setRes] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const ctrl = useRef(null), seq = useRef(0);
  useEffect(() => () => ctrl.current?.abort(), []);

  const run = useCallback(async () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true); setErr(""); setRes(null);
    try {
      const d = await postJson(`/c/${encodeURIComponent(conn.id)}/query`, { sql }, c.signal);
      const columns = rankColumns(d.columns || []);
      setRes({ ms: d.ms, columns, items: (d.rows || []).map((r) => ({ k: ++seq.current, r })), total: (d.rows || []).length, allColumns: columns.length });
    } catch (e) {
      if (!isAbort(e)) setErr(e.message);
    } finally {
      if (ctrl.current === c) setBusy(false);
    }
  }, [conn.id, sql]);

  const cols = res ? res.columns.slice(0, 8) : [];
  const numeric = useMemo(() => {
    const n = new Set();
    if (res) for (const k of cols) { const v = res.items.map((i) => i.r[k]).filter((x) => x != null); if (v.length && v.every((x) => typeof x === "number")) n.add(k); }
    return n;
  }, [res]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = useCallback((item, el) => onOpenRow(item, el, cols), [onOpenRow, res]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Flex direction="column" gap="sm" h="100%" mih={0}>
      <Stack gap="xs">
        <Textarea
          label="Query"
          aria-label="Query"
          autosize minRows={3} maxRows={8}
          value={sql}
          onChange={(e) => setSql(e.currentTarget.value)}
          spellCheck={false}
          autoComplete="off"
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); } }}
        />
        <Group gap="xs" justify="space-between">
          <Group gap="xs" role="group" aria-label="Examples">
            {examples.map(([label, s]) => <Button key={label} size="compact-sm" variant="default" onClick={() => setSql(s)}>{label}</Button>)}
          </Group>
          <Group gap="sm">
            <Text size="xs" c="dimmed" visibleFrom="sm">Only SELECT and HYBRID_SEARCH run. <Kbd size="xs">Ctrl</Kbd> + <Kbd size="xs">Enter</Kbd> runs it.</Text>
            <Button leftSection={<IconPlayerPlay size={16} />} loading={busy} onClick={run} disabled={!sql.trim()}>Run query</Button>
          </Group>
        </Group>
      </Stack>
      <Text size="sm" c="dimmed" role="status" aria-live="polite" mih={20}>
        {busy ? "Running…" : res ? `${nf.format(res.total)} ${res.total === 1 ? "row" : "rows"}${res.ms != null ? ` in ${nf.format(res.ms)} ms` : ""}${res.allColumns > 8 ? ". Showing 8 columns, open a row for all." : ""}` : ""}
      </Text>
      {err && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} title="That query did not run">
          <Text size="sm">{err}</Text>
        </Alert>
      )}
      {res && (
        <Flex direction="column" flex={1} mih={0}>
          <DataGrid label="Query results" items={res.items} columns={cols} numeric={numeric} loading={false} error="" done
            onLoadMore={noop} onRetry={noop} onDropFirst={noop} onOpen={open} selectedKey={selectedKey} resetKey={res.items} emptyText="The query ran and returned no rows." />
        </Flex>
      )}
    </Flex>
  );
}
