import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Center, Checkbox, Flex, Group, Highlight, ScrollArea, Skeleton, Stack, Table, Text, UnstyledButton } from "@mantine/core";
import { useIntersection } from "@mantine/hooks";
import { IconAlertCircle, IconArrowDown, IconArrowUp, IconSearchOff, IconSelector } from "@tabler/icons-react";
import { cellText } from "./api.js";
import { MAX_ROWS } from "./useRows.js";

const nf = new Intl.NumberFormat("en-US");
const ID_COL = /(^|_)id$|^_id$|uuid|^ref$/i;

const Row = React.memo(function Row({ item, cols, numeric, q, onOpen, selected, checkable, checked, onCheck }) {
  const open = (el) => onOpen(item, el);
  return (
    <Table.Tr
      tabIndex={0}
      data-selected={selected || undefined}
      bg={selected ? "var(--mantine-primary-color-light)" : undefined}
      onClick={(e) => open(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e.currentTarget); }
        else if (e.key === "ArrowDown") { e.preventDefault(); e.currentTarget.nextElementSibling?.focus?.(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); e.currentTarget.previousElementSibling?.focus?.(); }
      }}
    >
      {checkable && (
        <Table.Td w={40} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} valign="top">
          <Checkbox size="xs" checked={checked} onChange={() => onCheck(item.k)} aria-label="Select this row" />
        </Table.Td>
      )}
      {cols.map((c) => {
        const v = item.r[c];
        const empty = v === null || v === undefined || v === "";
        const isNum = numeric.has(c);
        const mono = ID_COL.test(c);
        return (
          <Table.Td key={c} ta={isNum ? "right" : "left"} miw={isNum ? 70 : 90} maw={420} valign="top">
            {empty ? (
              <Text size="sm" c="dimmed" aria-label="empty">&mdash;</Text>
            ) : q && !isNum ? (
              <Highlight highlight={q} size="sm" lineClamp={2} ff={mono ? "monospace" : undefined}>{cellText(v)}</Highlight>
            ) : (
              <Text size="sm" lineClamp={2} ff={mono ? "monospace" : undefined}>{cellText(v)}</Text>
            )}
          </Table.Td>
        );
      })}
    </Table.Tr>
  );
});

function SkeletonRows({ cols, n, extra = false }) {
  return Array.from({ length: n }, (_, i) => (
    <Table.Tr key={`sk${i}`} aria-hidden="true">
      {extra && <Table.Td />}
      {cols.map((c) => <Table.Td key={c}><Skeleton h={14} w={`${55 + ((i * 17 + c.length * 7) % 40)}%`} /></Table.Td>)}
    </Table.Tr>
  ));
}

// Presentational grid with infinite scroll. The data comes from useRows (or a fixed result with done = true).
export default function DataGrid({
  label, items, columns, numeric, q = "", loading, error, done, dropped = 0, resetKey,
  onLoadMore, onRetry, onDropFirst, onOpen, selectedKey, emptyText,
  sort = null, onSort, sortable = false, checked, onCheck, onCheckAll,
}) {
  const checkable = !!checked;
  const allChecked = checkable && items.length > 0 && items.every((it) => checked.has(it.k));
  const someChecked = checkable && !allChecked && items.some((it) => checked.has(it.k));
  const [viewport, setViewport] = useState(null);
  const paused = items.length >= MAX_ROWS;
  const canLoad = !done && !paused && !loading && !error && items.length > 0;
  // The sentinel is re-created after every page (key), so a short page keeps loading until the view is full.
  const { ref: sentinelRef, entry } = useIntersection({ root: viewport, rootMargin: "400px" });
  useEffect(() => {
    if (canLoad && entry?.isIntersecting && entry.target.isConnected) onLoadMore();
  }, [canLoad, entry, onLoadMore]);

  useEffect(() => { viewport?.scrollTo({ top: 0 }); }, [resetKey, viewport]);
  const dropFirst = useCallback(() => { onDropFirst(); viewport?.scrollTo({ top: 0 }); }, [onDropFirst, viewport]);

  const firstLoad = loading && !items.length;
  const empty = !loading && !error && !items.length;
  return (
    <Flex direction="column" h="100%" mih={0}>
      <ScrollArea flex={1} mih={0} type="auto" viewportRef={setViewport} aria-label={label}>
        <Table stickyHeader highlightOnHover withRowBorders aria-label={label} aria-busy={loading || undefined}>
          <Table.Thead>
            <Table.Tr>
              {checkable && (
                <Table.Th w={40}>
                  <Checkbox size="xs" checked={allChecked} indeterminate={someChecked} onChange={onCheckAll} disabled={!items.length}
                    aria-label={allChecked ? "Clear the selection" : `Select the ${items.length} loaded rows`} />
                </Table.Th>
              )}
              {columns.map((c) => {
                const on = sort?.col === c, dir = on ? sort.dir : null;
                const Icon = dir === "asc" ? IconArrowUp : dir === "desc" ? IconArrowDown : IconSelector;
                return (
                  <Table.Th key={c} ta={numeric.has(c) ? "right" : "left"} miw={numeric.has(c) ? 70 : 90} title={c}
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}>
                    {sortable && onSort ? (
                      <UnstyledButton onClick={() => onSort(c)} aria-label={`Sort by ${c}${on ? (dir === "asc" ? ", now ascending" : ", now descending") : ""}`} maw="100%">
                        <Group gap={4} wrap="nowrap" justify={numeric.has(c) ? "flex-end" : "flex-start"}>
                          <Text size="xs" fw={600} c={on ? undefined : "dimmed"} truncate="end">{c}</Text>
                          <Icon size={13} stroke={on ? 2.4 : 1.6} color={on ? "var(--mantine-primary-color-filled)" : "var(--mantine-color-dimmed)"} aria-hidden="true" />
                        </Group>
                      </UnstyledButton>
                    ) : (
                      <Text size="xs" fw={600} c="dimmed" truncate="end">{c}</Text>
                    )}
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((it) => <Row key={it.k} item={it} cols={columns} numeric={numeric} q={q} onOpen={onOpen} selected={selectedKey === it.k} checkable={checkable} checked={checkable && checked.has(it.k)} onCheck={onCheck} />)}
            {firstLoad && <SkeletonRows cols={columns.length ? columns : ["a", "b", "c", "d"]} n={10} extra={checkable} />}
            {loading && items.length > 0 && <SkeletonRows cols={columns} n={2} extra={checkable} />}
            {canLoad && <Table.Tr key={`s${items.length}`} ref={sentinelRef} aria-hidden="true"><Table.Td colSpan={Math.max(1, columns.length + (checkable ? 1 : 0))} p={0} h={1} bd="none" /></Table.Tr>}
          </Table.Tbody>
        </Table>
        {empty && (
          <Center py={60}>
            <Stack align="center" gap="xs">
              <IconSearchOff size={32} stroke={1.5} color="var(--mantine-color-dimmed)" aria-hidden="true" />
              <Text fw={500}>{q ? `No rows match "${q}"` : "Nothing here yet"}</Text>
              <Text size="sm" c="dimmed">{emptyText || (q ? "Try a shorter word, or clear the search." : "This one is empty.")}</Text>
            </Stack>
          </Center>
        )}
      </ScrollArea>
      <Stack gap="xs" pt="xs">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} title="Could not load rows" withCloseButton={false}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Text size="sm">{error}</Text>
              <Button size="compact-sm" variant="light" color="red" onClick={onRetry}>Retry</Button>
            </Group>
          </Alert>
        )}
        <Group gap="md" justify="space-between" mih={28} wrap="wrap">
          <Text size="sm" c="dimmed" aria-live="polite">
            {items.length > 0 && `Rows ${nf.format(dropped + 1)} to ${nf.format(dropped + items.length)}${done ? ", the end" : ""}`}
            {loading && items.length > 0 && " · Loading more…"}
          </Text>
          {paused && !done && (
            <Button size="compact-sm" variant="light" onClick={dropFirst}>Load the next 1,000 (the first 1,000 leave the view)</Button>
          )}
        </Group>
      </Stack>
    </Flex>
  );
}
