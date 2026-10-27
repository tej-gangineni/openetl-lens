---
name: lens-ui
description: Design and UX brief for the OpenETL Lens web UI, built with Mantine and no hand-written CSS. Use when building or changing anything in openetl-lens/web.
---

# OpenETL Lens UI

Read first: `.claude/skills/mantine-ui/SKILL.md` (the library, the no-CSS rule, which doc page to read), `.claude/skills/ux-principles/SKILL.md` (the usability checklist), `.claude/skills/frontend-design/SKILL.md` (taste: avoid template tells, restraint),
`.claude/skills/mantine-form/SKILL.md` (forms), `.claude/skills/web-design-guidelines/SKILL.md` (accessibility and interaction rules; the rules text is in its `upstream/command.md`), `.claude/skills/composition-patterns/SKILL.md` and `.claude/skills/react-best-practices/SKILL.md` (React 19), `API_CONTRACT.md`.

## What it is
A very small Metabase-style data browser. Connect a database, test it, browse its tables, scroll rows, search, open a row, delete the connection. Nothing else. Every connection looks like its own data: its colour, icon and name carry the screen it is on.

## No CSS
We write no CSS (see mantine-ui). All layout and look come from Mantine components, style props and `web/src/theme.js`. The only stylesheets are Mantine's own, imported in `main.jsx`.

## Layout: one sidebar, no top bar
- `AppShell` with a **navbar only**. There is no header and no top bar.
- **Logo and sidebar toggle share one spot**, top-left of the sidebar. At rest it shows the OpenETL Lens logo (`Logo.jsx`). When the pointer is over it (`useHover`) or it has keyboard focus, the logo is replaced by the open/close icon (`IconLayoutSidebarLeftCollapse` / `IconLayoutSidebarLeftExpand`) with the tooltip "Close sidebar" / "Open sidebar" and the shortcut. Click toggles. Next to it sits the wordmark "OpenETL Lens". It must be a real button with an `aria-label`, and touch devices simply show the toggle icon.
- When the sidebar is closed, the same logo/toggle stays fixed at the top-left of the page (same position, `pos="fixed"`), so it can always be reopened, and the page content leaves room for it. The state is remembered (`useLocalStorage`) and `Ctrl/Cmd + B` toggles it. Under the `sm` breakpoint the navbar is an overlay.
- Sidebar content, top to bottom: the logo/toggle row; a full-width **Add data** button; a "Search... Ctrl K" button that opens the command palette; the heading "Your data"; the **tree**; at the bottom a **Highlights** link and the light/dark/auto switch (`SegmentedControl` with icons).
- **The tree is the navigation.** Each connection is a `NavLink` (type icon, name, a small status dot). The open connection is expanded and its **tables are nested beneath it** as child `NavLink`s with their row counts (`Badge`). Tables are not shown anywhere else. Clicking a connection selects it and expands it; the first table opens automatically. While tables load show `Skeleton` rows.

## Screens
1. **Home** (`#home`): title "Your data"; a grid of connection cards (icon, name, "12 tables · 1,000 records", status). Empty state: icon, "No data connected yet", Add data button, and Restore sample connections when some are hidden. A quiet "N sample connections are hidden. Restore" line otherwise.
2. **Connection and table** (`#c/<id>?t=<table>`): `Breadcrumbs` (Your data, connection, table); a title row with the table name and a count badge; a one-line summary of the connection in `Code`; a status `Badge`; a `Menu` (three dots) with Test connection, Delete connection. Below: search `TextInput` (placeholder "Search in <table>", clear button, `/` focuses it) and a column picker (`Menu` or `Popover` with checkboxes, first 8 columns on by default, readable columns first). Then the grid.
3. **Grid**: Mantine `Table` in a `ScrollArea` that fills the height, sticky header, rows clickable and keyboard reachable, numbers right-aligned, ids in the monospace face, long text clamped (`lineClamp`), search matches highlighted (`Highlight`). **Infinite scroll, page size 100, one request in flight, abort stale requests, 300 ms debounce, at most 3,000 rows mounted** with a "Load the next 1,000" button, exactly as in API_CONTRACT.md. `useIntersection` for the sentinel. Skeleton rows while loading, an error `Alert` with Retry, an empty state ("No rows match 'x'").
4. **Row drawer** (`Drawer`, right): `Tabs` Fields, Text, JSON. Fields as a definition list with a copy button each; Text shows the full text; if it holds a markdown table, parse it and show a table plus `LineChart`s of the numeric columns; JSON shows the whole record in `Code` with `CopyButton`. If a value was cut (ends with the ellipsis) and the row has `__ref`, fetch `GET /api/c/:id/row?container=&ref=` and show the full record (loading skeleton, graceful note on failure).
4b. **Relata**: a `SegmentedControl` Browse / Query in the title row; Query is a console (`Textarea`, example chips, Run with `loading`, results table, plain-language errors).
5. **Add data** (`Modal`): step 1, a grid of six type cards (icon, name, one line); step 2, a form (`@mantine/form`) with the type's fields, a name, **Test connection** (`loading`, result in an `Alert`: "Connected. Found 3 tables." or the error in plain words) and **Save** (disabled until the test passed for the current values). Back, Cancel, Enter submits, Escape closes. After saving go to the new connection and show a notification.
6. **Delete**: `modals.openConfirmModal` titled "Delete <name>?", text "This removes the connection from Lens. Your data is not touched." (plus, for a sample connection, "You can bring it back with Restore sample connections on the home page."), confirm button red "Delete". After deleting: go Home, notification "<name> deleted".
7. **Highlights** (`#highlights`): cards with `BarChart`s from `@mantine/charts` for `/api/insights` (a chart whose data has `error` shows that message in its card).
8. **Command palette** (`@mantine/spotlight`, Ctrl/Cmd + K): actions for Add data, Highlights, every connection, and every table of the open connection. Selecting navigates.

## UX rules (from the ux-principles skill)
Visible status everywhere (skeletons, per-panel errors with Retry), plain words ("tables", "collections", "indices" per type), nothing destructive without a confirmation, every dialog closes with Escape, consistent names (Add data, Test connection, Save, Delete), remembered choices (sidebar, theme, last table), shortcuts for experts, an empty state that says what to do next. Sentence case. No jargon such as "built in" or "ref".

## Quality floor
Keyboard reachable everywhere with visible focus, labels on fields, `aria-label` on icon-only buttons, `aria-live` for results, works at 400 px wide, dark mode through Mantine's color scheme, counts use `Intl.NumberFormat`, tabular numbers. Memoize rows, no layout reads in render, passive listeners.
