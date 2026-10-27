import React, { useCallback, useEffect, useState } from "react";
import { Alert, Anchor, Badge, Box, Button, Card, Container, Group, Paper, Progress, SimpleGrid, Skeleton, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import TypeIcon from "./TypeIcon.jsx";
import { typeOf } from "./typeMeta.js";
import { connHref, plural } from "./nav.js";
import { api, fmt } from "./api.js";

function Stat({ label, value, note, loading }) {
  return (
    <Paper withBorder radius="md" p="md" component="section" aria-label={label}>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" lts={0.5}>{label}</Text>
      {loading ? <Skeleton h={32} w="60%" mt={6} /> : <Text fz={28} fw={700} lh={1.2} mt={4} ff="monospace">{value}</Text>}
      {note && !loading && <Text size="xs" c="dimmed" truncate="end" mt={2}>{note}</Text>}
    </Paper>
  );
}

// One box per connection, tinted like its type, with its biggest tables as bars.
function ConnectionBox({ c, max }) {
  const t = typeOf(c.type);
  const biggest = Math.max(1, ...c.top.map((r) => r.value));
  return (
    <Card withBorder padding={0} radius="md" component="section" aria-label={c.name}>
      <Card.Section h={4} bg={`${t.color}.5`} />
      <Stack gap="sm" p="md">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <TypeIcon type={c.type} size={36} />
            <Box miw={0}>
              <Anchor href={connHref(c.id)} fw={600} underline="hover" c="inherit" truncate="end" display="block">{c.name}</Anchor>
              <Text size="xs" c="dimmed">{plural(c.tables, t.noun, t.nouns)}</Text>
            </Box>
          </Group>
          <Badge variant="light" color={c.ok ? "green" : "red"} size="sm">{c.ok ? "Connected" : "Unreachable"}</Badge>
        </Group>
        {c.ok ? (
          <>
            <div>
              <Text fz={26} fw={700} lh={1.1} ff="monospace">{fmt(c.records)}</Text>
              <Text size="xs" c="dimmed">records in total</Text>
              <Progress value={max ? (100 * c.records) / max : 0} color={t.color} size="xs" mt={6} aria-label={`${c.name} holds ${fmt(c.records)} of the largest connection's ${fmt(max)} records`} />
            </div>
            {c.top.length > 0 ? (
              <Stack gap={8}>
                {c.top.map((r) => (
                  <div key={r.label}>
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Anchor href={connHref(c.id, { table: r.label })} size="sm" c="inherit" underline="hover" truncate="end" title={r.label}>{r.label}</Anchor>
                      <Text size="xs" c="dimmed" ff="monospace">{fmt(r.value)}</Text>
                    </Group>
                    <Progress value={(100 * r.value) / biggest} color={t.color} size={6} radius="xl" mt={3} aria-hidden="true" />
                  </div>
                ))}
              </Stack>
            ) : <Text size="sm" c="dimmed">No {t.nouns} to count yet.</Text>}
          </>
        ) : <Text size="sm" c="red" role="alert" lineClamp={3}>{c.error}</Text>}
      </Stack>
    </Card>
  );
}

function Share({ conns, total }) {
  const rows = conns.filter((c) => c.ok && c.records > 0);
  if (total === 0 || rows.length === 0) return null;
  return (
    <Paper withBorder radius="md" p="md" component="section" aria-label="Where the records live">
      <Title order={2} size="h5">Where the records live</Title>
      <Text size="xs" c="dimmed" mb="sm">Each connection's share of all {fmt(total)} records</Text>
      <Progress.Root size={22} radius="md">
        {rows.map((c) => (
          <Tooltip key={c.id} label={`${c.name}: ${fmt(c.records)} (${Math.round((100 * c.records) / total)}%)`}>
            <Progress.Section value={(100 * c.records) / total} color={typeOf(c.type).color} aria-label={`${c.name} ${Math.round((100 * c.records) / total)} percent`} />
          </Tooltip>
        ))}
      </Progress.Root>
      <Group gap="md" mt="sm">
        {rows.map((c) => (
          <Group key={c.id} gap={6} wrap="nowrap">
            <Badge circle size="8" color={typeOf(c.type).color} aria-hidden="true" />
            <Text size="xs">{c.name} <Text span c="dimmed">{Math.round((100 * c.records) / total)}%</Text></Text>
          </Group>
        ))}
      </Group>
    </Paper>
  );
}

export default function HighlightsPage() {
  const [data, setData] = useState(null), [error, setError] = useState("");
  const load = useCallback(() => { setError(""); setData(null); api("/insights").then(setData).catch((e) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const loading = data === null && !error;
  const conns = data?.connections ?? [];
  const total = conns.reduce((n, c) => n + c.records, 0);
  const tables = conns.reduce((n, c) => n + c.tables, 0);
  const up = conns.filter((c) => c.ok).length;
  const max = Math.max(0, ...conns.map((c) => c.records));
  const biggest = data?.largest?.[0];
  return (
    <Container size="lg" p={0} pt="md">
      <Stack gap={4} mb="lg">
        <Title order={1} size="h2">Highlights</Title>
        <Text c="dimmed" size="sm">A quick look at everything you have connected. Counts only, so it stays fast.</Text>
      </Stack>
      {error ? (
        <Alert color="red" icon={<IconAlertCircle size={18} />} title="Could not load the highlights" role="alert">
          <Text size="sm" mb="xs">{error}</Text>
          <Button size="xs" variant="light" color="red" onClick={load}>Try again</Button>
        </Alert>
      ) : (
        <Stack gap="md" aria-busy={loading}>
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Stat label="Connections" value={conns.length} note={`${up} connected`} loading={loading} />
            <Stat label="Records" value={fmt(total)} note="across everything" loading={loading} />
            <Stat label="Tables" value={fmt(tables)} note="collections, indices and types too" loading={loading} />
            <Stat label="Largest table" value={biggest ? fmt(biggest.value) : "–"} note={biggest ? `${biggest.label} · ${biggest.group}` : "nothing counted yet"} loading={loading} />
          </SimpleGrid>
          {!loading && <Share conns={conns} total={total} />}
          {loading ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={300} radius="md" />)}</SimpleGrid>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>{conns.map((c) => <ConnectionBox key={c.id} c={c} max={max} />)}</SimpleGrid>
          )}
        </Stack>
      )}
    </Container>
  );
}
