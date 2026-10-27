import React, { useEffect, useState } from "react";
import { ActionIcon, Alert, Box, Code, CopyButton, Drawer, Group, ScrollArea, Skeleton, Stack, Table, Tabs, Text, Tooltip } from "@mantine/core";
import { LineChart } from "@mantine/charts";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { api, qs, cellText } from "./api.js";

const COLORS = ["indigo.6", "teal.6", "orange.6", "grape.6"];
const isCut = (v) => typeof v === "string" && v.endsWith("…") && v.length >= 1990;
const isLong = (v) => typeof v === "string" && (v.length > 160 || v.includes("\n"));

// Parse a markdown table (as OpenETL stores a CSV): header row, divider row, then rows.
export function parseMdTable(text) {
  const lines = String(text || "").split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 3) return null;
  const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const head = cells(lines[0]);
  return { head, rows: lines.slice(2).map((l) => Object.fromEntries(cells(l).map((c, i) => [head[i], c]))) };
}

function Copy({ value, label }) {
  return (
    <CopyButton value={value} timeout={1500}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? "Copied" : "Copy"} position="left">
          <ActionIcon variant="subtle" color={copied ? "teal" : "gray"} size="sm" onClick={copy} aria-label={copied ? "Copied" : `Copy ${label}`}>
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}

// A parsed table: one line chart per numeric column (first four), then the rows.
function MdTable({ table }) {
  const first = table.head[0];
  const numeric = table.head.slice(1).filter((h) => table.rows.length && table.rows.every((r) => r[h] !== "" && Number.isFinite(Number(r[h])))).slice(0, 4);
  const shown = table.rows.slice(0, 500);
  const data = table.rows.map((r) => ({ x: String(r[first] ?? ""), ...Object.fromEntries(numeric.map((h) => [h, Number(r[h])])) }));
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">This text holds a table with {table.rows.length.toLocaleString("en-US")} rows.</Text>
      {numeric.map((h, i) => (
        <Box key={h}>
          <Text size="xs" fw={600} c="dimmed" mb={4}>{h}</Text>
          <LineChart h={150} data={data} dataKey="x" series={[{ name: h, color: COLORS[i % COLORS.length] }]} withDots={false} curveType="linear" tickLine="y" gridAxis="x" aria-label={`${h} over ${first}`} />
        </Box>
      ))}
      <ScrollArea.Autosize mah={320} type="auto">
        <Table stickyHeader withTableBorder withColumnBorders>
          <Table.Thead><Table.Tr>{table.head.map((h) => <Table.Th key={h}>{h}</Table.Th>)}</Table.Tr></Table.Thead>
          <Table.Tbody>
            {shown.map((r, i) => <Table.Tr key={i}>{table.head.map((h) => <Table.Td key={h}><Text size="xs">{r[h]}</Text></Table.Td>)}</Table.Tr>)}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {table.rows.length > shown.length && <Text size="xs" c="dimmed">Showing the first {shown.length} rows.</Text>}
    </Stack>
  );
}

// state: idle | loading | full | failed
function useFullRecord(row, connId, container) {
  const ref = row?.__ref;
  const cut = !!row && Object.values(row).some(isCut);
  const wants = cut && !!ref && !!connId && !!container;
  const [res, setRes] = useState({ row: null, state: "idle" });
  useEffect(() => {
    if (!wants) { setRes({ row: null, state: "idle" }); return; }
    const c = new AbortController();
    setRes({ row: null, state: "loading" });
    api(`/c/${encodeURIComponent(connId)}/row?${qs({ container, ref })}`, { signal: c.signal })
      .then((d) => setRes(d?.row ? { row: d.row, state: "full" } : { row: null, state: "failed" }))
      .catch((e) => { if (e.name !== "AbortError") setRes({ row: null, state: "failed" }); });
    return () => c.abort();
  }, [wants, ref, connId, container]);
  return { ...res, cut };
}

export default function RowDrawer({ opened, onClose, conn, container, row, columns = [] }) {
  const { row: full, state, cut } = useFullRecord(opened ? row : null, conn?.id, container);
  const data = full || row || {};
  const keys = Object.keys(data).filter((k) => k !== "__ref");
  const clean = Object.fromEntries(keys.map((k) => [k, data[k]]));
  const json = JSON.stringify(clean, null, 2);
  const title = cellText(data[columns[0]]).slice(0, 80) || container || "Record";
  const longKeys = keys.filter((k) => isLong(data[k]));

  return (
    <Drawer opened={opened} onClose={onClose} size="xl" title={<Text fw={600} truncate="end" maw={480}>{title}</Text>} keepMounted={false} aria-label="Record">
      <Stack gap="md">
        <Box aria-live="polite">
          {state === "loading" && <Stack gap={6} aria-label="Loading the full record"><Skeleton h={12} /><Skeleton h={12} w="70%" /></Stack>}
          {state === "failed" && <Alert color="yellow" variant="light" p="xs">Some long values are cut at 2,000 characters. The full record could not be loaded.</Alert>}
          {state === "idle" && cut && <Text size="sm" c="dimmed">Some long values are cut at 2,000 characters.</Text>}
        </Box>
        <Tabs defaultValue="fields" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="fields">Fields</Tabs.Tab>
            <Tabs.Tab value="text">Text</Tabs.Tab>
            <Tabs.Tab value="json">JSON</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="fields" pt="md">
            <Stack gap="sm" component="dl" m={0}>
              {keys.map((k) => {
                const v = data[k];
                const text = cellText(v);
                return (
                  <Box key={k}>
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Text component="dt" size="xs" fw={600} c="dimmed" ff="monospace" truncate="end">{k}</Text>
                      {text && <Copy value={text} label={k} />}
                    </Group>
                    <Text component="dd" size="sm" m={0} lineClamp={6}>{text || <Text span c="dimmed">Empty</Text>}</Text>
                  </Box>
                );
              })}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="text" pt="md">
            {longKeys.length === 0 ? (
              <Text size="sm" c="dimmed">This record has no long text. See the Fields tab.</Text>
            ) : (
              <Stack gap="lg">
                {longKeys.map((k) => {
                  const table = parseMdTable(data[k]);
                  return (
                    <Box key={k}>
                      <Group justify="space-between" mb={4}>
                        <Text size="xs" fw={600} c="dimmed" ff="monospace">{k}</Text>
                        <Copy value={data[k]} label={k} />
                      </Group>
                      {table ? <MdTable table={table} /> : <Code block>{data[k]}</Code>}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="json" pt="md">
            <Group justify="flex-end" mb={4}><Copy value={json} label="the record as JSON" /></Group>
            <Code block mah="60dvh">{json}</Code>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Drawer>
  );
}
