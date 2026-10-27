import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Container, SimpleGrid, Skeleton, Stack, Text, Title } from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { IconAlertCircle } from "@tabler/icons-react";
import { api } from "./api.js";

const number = (v) => new Intl.NumberFormat("en-US").format(v);

function Panel({ title, note, loading, empty, children }) {
  return (
    <Card withBorder padding="md" radius="md" component="section" aria-label={title}>
      <Stack gap={2} mb="sm">
        <Title order={2} size="h5">{title}</Title>
        {note && <Text size="xs" c="dimmed">{note}</Text>}
      </Stack>
      {loading ? <Skeleton h={220} /> : empty ? <Text size="sm" c="dimmed" role="status" mih={60}>Nothing to show yet.</Text> : children}
    </Card>
  );
}

// A sideways bar chart of [{ label, value }] so long names stay readable.
function Ranked({ title, note, rows, loading, unit, color }) {
  const data = Array.isArray(rows) ? rows : [];
  return (
    <Panel title={title} note={note} loading={loading} empty={!loading && data.length === 0}>
      <BarChart h={Math.max(160, data.length * 34 + 40)} data={data} dataKey="label" orientation="vertical" series={[{ name: "value", label: unit, color }]}
        yAxisProps={{ width: 120 }} barProps={{ maxBarSize: 28 }} valueFormatter={number} tickLine="none" gridAxis="x" withBarValueLabel />
    </Panel>
  );
}

export default function HighlightsPage() {
  const [data, setData] = useState(null), [error, setError] = useState("");
  const load = useCallback(() => { setError(""); setData(null); api("/insights").then(setData).catch((e) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const loading = data === null && !error;
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
        <Stack gap="md">
          {data?.unreachable?.length > 0 && (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />} title="Some connections did not answer" role="status">
              {data.unreachable.map((u) => <Text size="sm" key={u.name}>{u.name}: {u.error}</Text>)}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, md: 2 }} aria-busy={loading}>
            <Ranked title="Records per connection" note="Rows, documents or points, added up" rows={data?.records} loading={loading} unit="Records" color="indigo.6" />
            <Ranked title="Tables per connection" note="Tables, collections, indices or types" rows={data?.tables} loading={loading} unit="Tables" color="teal.6" />
          </SimpleGrid>
          <Ranked title="Largest tables" note="The biggest ones across every connection" rows={data?.largest} loading={loading} unit="Records" color="violet.6" />
        </Stack>
      )}
    </Container>
  );
}
