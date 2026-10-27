import React, { useEffect } from "react";
import { Anchor, Badge, Button, Card, Center, Container, Group, SimpleGrid, Skeleton, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconDatabaseOff, IconPlus } from "@tabler/icons-react";
import TypeIcon from "./TypeIcon.jsx";
import { typeOf } from "./typeMeta.js";
import { connHref, plural } from "./nav.js";
import { useApp } from "./AppContext.jsx";

const BADGE = { up: ["green", "Connected"], down: ["red", "Unreachable"], unknown: ["gray", "Checking…"] };

function ConnCard({ conn }) {
  const { status, getTables } = useApp();
  const meta = typeOf(conn.type);
  const t = getTables(conn.id);
  const [color, text] = BADGE[status(conn.id)];
  const records = t.items.reduce((n, x) => n + (typeof x.count === "number" ? x.count : 0), 0);
  const known = t.items.some((x) => typeof x.count === "number");
  let line;
  if (t.status === "ok") line = `${plural(t.items.length, meta.noun, meta.nouns)}${known ? ` · ${plural(records, "record", "records")}` : ""}`;
  else if (t.status === "error") line = "Could not read it right now";
  if (!line) line = null;
  return (
    <Card component="a" href={connHref(conn.id)} withBorder padding="md" radius="md" aria-label={`Open ${conn.name}`}>
      <Group wrap="nowrap" align="flex-start">
        <TypeIcon type={conn.type} size={42} />
        <Stack gap={2} miw={0} flex={1}>
          <Text fw={600} truncate="end">{conn.name}</Text>
          <Text size="xs" c="dimmed" truncate="end">{meta.label}</Text>
        </Stack>
        <Badge variant="dot" color={color} size="sm">{text}</Badge>
      </Group>
      <Stack gap={4} mt="md">
        {line ? <Text size="sm">{line}</Text> : <Skeleton h={14} w="60%" />}
        <Text size="xs" c="dimmed" ff="monospace" truncate="end" title={conn.summary}>{conn.summary}</Text>
      </Stack>
    </Card>
  );
}

export default function HomePage() {
  const { conns, hiddenDefaults, openAdd, restore, loadTables } = useApp();
  const ids = (conns || []).map((c) => c.id).join(",");
  useEffect(() => { if (ids) ids.split(",").forEach((id) => loadTables(id)); }, [ids, loadTables]);

  return (
    <Container size="lg" p={0} pt="md">
      <Group justify="space-between" mb="lg">
        <Title order={1} size="h2">Your data</Title>
        {conns?.length > 0 && <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Add data</Button>}
      </Group>
      {conns === null ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} aria-busy="true" aria-label="Loading your data">
          {[0, 1, 2].map((i) => <Skeleton key={i} h={128} radius="md" />)}
        </SimpleGrid>
      ) : conns.length === 0 ? (
        <Center py={80}>
          <Stack align="center" gap="sm" maw={420} ta="center">
            <ThemeIcon variant="light" color="gray" size={64} radius="xl"><IconDatabaseOff size={32} stroke={1.4} aria-hidden="true" /></ThemeIcon>
            <Title order={2} size="h3">No data connected yet</Title>
            <Text c="dimmed">Connect a database to browse its tables and search its rows.</Text>
            <Group justify="center" mt="xs">
              <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>Add data</Button>
              {hiddenDefaults > 0 && <Button variant="default" onClick={restore}>Restore sample connections</Button>}
            </Group>
          </Stack>
        </Center>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {conns.map((c) => <ConnCard key={c.id} conn={c} />)}
          </SimpleGrid>
          {hiddenDefaults > 0 && (
            <Text size="sm" c="dimmed" mt="lg">
              {plural(hiddenDefaults, "sample connection", "sample connections")} {hiddenDefaults === 1 ? "is" : "are"} hidden.{" "}
              <Anchor component="button" type="button" size="sm" onClick={restore}>Restore</Anchor>
            </Text>
          )}
        </>
      )}
    </Container>
  );
}
