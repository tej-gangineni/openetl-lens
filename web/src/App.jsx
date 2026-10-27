import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActionIcon, AppShell, Box, Button, Center, Divider, Indicator, Kbd, NavLink, ScrollArea, SegmentedControl, Stack, Text, ThemeIcon, Title, Tooltip, UnstyledButton, useMantineColorScheme } from "@mantine/core";
import { useDisclosure, useHotkeys, useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { spotlight } from "@mantine/spotlight";
import { IconChartBar, IconDeviceDesktop, IconMoon, IconPlus, IconSearch, IconSun, IconPlugConnectedX } from "@tabler/icons-react";
import { AppContext, useApp } from "./AppContext.jsx";
import { useConnections } from "./useConnections.js";
import SidebarHeader, { MOD, SidebarToggle } from "./SidebarHeader.jsx";
import TypeIcon from "./TypeIcon.jsx";
import NavTree from "./NavTree.jsx";
import SearchPalette from "./SearchPalette.jsx";
import HomePage from "./HomePage.jsx";
import HighlightsPage from "./HighlightsPage.jsx";
import ConnectionPage from "./ConnectionPage.jsx";
import AddDataModal from "./AddDataModal.jsx";
import { confirmDelete } from "./confirmDelete.js";
import { api } from "./api.js";
import { parseHash, connHref } from "./nav.js";
import Logo from "./Logo.jsx";

const lastTableKey = (id) => `lens.table.${id}`;
const remembered = (id) => { try { return localStorage.getItem(lastTableKey(id)); } catch { return null; } };
const remember = (id, table) => { try { localStorage.setItem(lastTableKey(id), table); } catch { /* storage blocked */ } };

function Rail({ route }) {
  const { conns, status, openAdd, sidebarOpen, toggleSidebar } = useApp();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const next = { light: "dark", dark: "auto", auto: "light" }[colorScheme];
  const ThemeGlyph = { light: IconSun, dark: IconMoon, auto: IconDeviceDesktop }[colorScheme];
  const DOT = { up: "green", down: "red", unknown: "gray" };
  return (
    <AppShell.Navbar id="lens-sidebar" py="md" px={0} aria-label="Sidebar">
      <Stack align="center" gap="sm" h="100%">
        <UnstyledButton component="a" href="#home" aria-label="OpenETL Lens, home"><Logo size={30} /></UnstyledButton>
        <SidebarToggle open={sidebarOpen} onToggle={toggleSidebar} />
        <Tooltip label="Add data" position="right"><ActionIcon size="lg" onClick={openAdd} aria-label="Add data"><IconPlus size={18} /></ActionIcon></Tooltip>
        <Divider w="60%" />
        <ScrollArea type="never" flex={1} w="100%">
          <Stack align="center" gap="xs">
            {conns?.map((c) => (
              <Tooltip key={c.id} label={c.name} position="right">
                <UnstyledButton component="a" href={connHref(c.id)} aria-label={c.name} aria-current={route.page === "c" && route.id === c.id ? "page" : undefined}
                  bdrs="md" p={2} bd={route.page === "c" && route.id === c.id ? "2px solid var(--mantine-primary-color-filled)" : "2px solid transparent"}>
                  <Indicator color={DOT[status(c.id)]} size={9} offset={3} position="bottom-end" withBorder><TypeIcon type={c.type} size={30} /></Indicator>
                </UnstyledButton>
              </Tooltip>
            ))}
          </Stack>
        </ScrollArea>
        <Tooltip label="Highlights" position="right">
          <ActionIcon component="a" href="#highlights" size="lg" variant={route.page === "highlights" ? "light" : "subtle"} color={route.page === "highlights" ? undefined : "gray"} aria-label="Highlights">
            <IconChartBar size={20} stroke={1.6} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={`Theme: ${colorScheme}. Switch to ${next}`} position="right">
          <ActionIcon size="lg" variant="subtle" color="gray" onClick={() => setColorScheme(next)} aria-label={`Color theme: ${colorScheme}. Switch to ${next}`}><ThemeGlyph size={18} /></ActionIcon>
        </Tooltip>
      </Stack>
    </AppShell.Navbar>
  );
}

function Navbar({ route, onNavigate }) {
  const { openAdd, sidebarOpen, toggleSidebar } = useApp();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <AppShell.Navbar id="lens-sidebar" p="md" aria-label="Sidebar">
      <AppShell.Section mb="md"><SidebarHeader open={sidebarOpen} onToggle={toggleSidebar} /></AppShell.Section>
      <AppShell.Section>
        <Stack gap="xs">
          <Button fullWidth size="md" leftSection={<IconPlus size={18} />} onClick={() => { onNavigate(); openAdd(); }}>Add data</Button>
          <Button fullWidth variant="default" justify="space-between" leftSection={<IconSearch size={16} />} rightSection={<Kbd size="xs">{MOD} K</Kbd>}
            onClick={() => spotlight.open()} aria-label={`Search, shortcut ${MOD} K`} fw={400} c="dimmed">Search…</Button>
        </Stack>
        <Title order={2} size="xs" c="dimmed" fw={600} mt="lg" mb={6} px="xs">Your data</Title>
      </AppShell.Section>
      <AppShell.Section grow component={ScrollArea} type="auto" scrollbars="y" mx={-8} px={8}>
        <NavTree route={route} onNavigate={onNavigate} />
      </AppShell.Section>
      <AppShell.Section pt="sm">
        <Divider mb="xs" />
        <NavLink href="#highlights" onClick={onNavigate} active={route.page === "highlights"} variant="light" label="Highlights"
          leftSection={<IconChartBar size={18} stroke={1.6} aria-hidden="true" />} />
        <SegmentedControl fullWidth size="xs" mt="xs" aria-label="Color theme" value={colorScheme} onChange={setColorScheme}
          data={[
            { value: "light", label: <Center inline><IconSun size={14} aria-hidden="true" /><Box component="span" ml={6}>Light</Box></Center> },
            { value: "dark", label: <Center inline><IconMoon size={14} aria-hidden="true" /><Box component="span" ml={6}>Dark</Box></Center> },
            { value: "auto", label: <Center inline><IconDeviceDesktop size={14} aria-hidden="true" /><Box component="span" ml={6}>Auto</Box></Center> },
          ]} />
      </AppShell.Section>
    </AppShell.Navbar>
  );
}

export default function App() {
  const data = useConnections();
  const { conns, refresh, getTables, loadTables } = data;
  const [route, setRoute] = useState(parseHash);
  const [addOpen, addHandlers] = useDisclosure(false);
  const mobile = useMediaQuery("(max-width: 47.99em)");
  const [desktopOpen, setDesktopOpen] = useLocalStorage({ key: "lens.sidebar", defaultValue: true, getInitialValueInEffect: false });
  const [mobileOpen, mobileHandlers] = useDisclosure(false);
  const sidebarOpen = mobile ? mobileOpen : desktopOpen;
  const toggleSidebar = useCallback(() => { if (mobile) mobileHandlers.toggle(); else setDesktopOpen((o) => !o); }, [mobile, mobileHandlers, setDesktopOpen]);
  useHotkeys([["mod+B", toggleSidebar]]);

  useEffect(() => {
    const f = () => setRoute(parseHash());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const cur = route.page === "c" ? conns?.find((c) => c.id === route.id) : null;
  useEffect(() => {
    document.title = cur ? `${cur.name} · OpenETL Lens` : route.page === "highlights" ? "Highlights · OpenETL Lens"
      : route.page === "c" ? "Not found · OpenETL Lens" : "Your data · OpenETL Lens";
  }, [cur, route.page]);

  // opening a connection loads its tables; with none chosen, the last one used (or the first) opens
  const tables = cur ? getTables(cur.id) : null;
  useEffect(() => { if (cur) loadTables(cur.id); }, [cur?.id, loadTables]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!cur || !route.table) return;
    remember(cur.id, route.table);
  }, [cur?.id, route.table]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!cur || route.table || route.view === "query" || tables?.status !== "ok" || tables.items.length === 0) return;
    const names = tables.items.map((t) => t.name);
    const last = remembered(cur.id);
    location.replace(connHref(cur.id, { table: names.includes(last) ? last : names[0] }));
  }, [cur?.id, route.table, route.view, tables]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = addHandlers.open;
  const restore = useCallback(async () => {
    try {
      const d = await api("/connections/restore-defaults", { method: "POST" });
      await refresh();
      notifications.show({ message: d.restored === 1 ? "1 sample connection restored" : `${d.restored} sample connections restored`, color: "green" });
    } catch (e) { notifications.show({ title: "Could not restore", message: e.message, color: "red" }); }
  }, [refresh]);
  const requestDelete = useCallback((conn) => {
    confirmDelete(conn, () => {
      location.hash = "#home";
      refresh();
      notifications.show({ message: `${conn.name} deleted`, color: "green" });
    });
  }, [refresh]);
  const onSaved = useCallback(async (c) => {
    addHandlers.close();
    await refresh();
    location.hash = connHref(c.id);
    notifications.show({ message: `${c.name} added`, color: "green" });
  }, [refresh, addHandlers]);

  const value = useMemo(() => ({ ...data, openAdd, requestDelete, restore, sidebarOpen, toggleSidebar }),
    [data, openAdd, requestDelete, restore, sidebarOpen, toggleSidebar]);
  const onNavigate = useCallback(() => { if (mobile) mobileHandlers.close(); }, [mobile, mobileHandlers]);

  let page;
  if (route.page === "highlights") page = <HighlightsPage />;
  else if (route.page === "c") {
    page = cur ? <ConnectionPage key={cur.id} conn={cur} route={route} /> : conns === null ? null : (
      <Center py={80}>
        <Stack align="center" gap="sm" maw={420} ta="center">
          <ThemeIcon variant="light" color="gray" size={64} radius="xl"><IconPlugConnectedX size={32} stroke={1.4} aria-hidden="true" /></ThemeIcon>
          <Title order={2} size="h3">We could not find that connection</Title>
          <Text c="dimmed">It may have been deleted. Pick another one from the sidebar.</Text>
          <Button component="a" href="#home" variant="default">Go to your data</Button>
        </Stack>
      </Center>
    );
  } else page = <HomePage />;

  return (
    <AppContext.Provider value={value}>
      <AppShell padding="md" navbar={{ width: desktopOpen || mobile ? 288 : 68, breakpoint: "sm", collapsed: { mobile: !mobileOpen } }}>
        {mobile || desktopOpen ? <Navbar route={route} onNavigate={onNavigate} /> : <Rail route={route} />}
        <AppShell.Main id="main">
          {mobile && !mobileOpen && <Box pb="sm"><SidebarToggle open={false} onToggle={toggleSidebar} tooltipPosition="bottom" /></Box>}
          {page}
        </AppShell.Main>
      </AppShell>
      <SearchPalette route={route} />
      <AddDataModal opened={addOpen} onClose={addHandlers.close} onSaved={onSaved} />
    </AppContext.Provider>
  );
}
