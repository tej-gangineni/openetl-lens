---
name: lens-ui
description: Design brief and rules for the OpenETL Lens web UI. Use when building or changing anything in openetl-lens/web. Combines the frontend-design, web-design-guidelines, react-best-practices and composition-patterns skills into one Metabase-style, very minimal data browser.
---

# OpenETL Lens UI

Read these first, in this order, and apply them:
1. `.claude/skills/frontend-design/SKILL.md` (design process and what to avoid)
2. `.claude/skills/web-design-guidelines/upstream/command.md` (the rules you will be reviewed against)
3. `.claude/skills/composition-patterns/SKILL.md` and `.claude/skills/react-best-practices/SKILL.md` (React 18, Vite, client only)
4. `API_CONTRACT.md` (the API; also the pagination and bounded-DOM rules)
5. `web/src/tokens.css` and `web/src/typeMeta.js`, `web/src/Badge.jsx` (shared tokens, connection types, badge; do not invent new palettes)

## What it is
A very small Metabase-like app. Someone adds a database, tests it, browses its tables and scrolls its rows, and deletes it when done.
That is all. No dashboards builder, no questions, no settings page. Fewer controls is the goal.

## The one idea: every connection looks like its own data
When a connection is open, the whole view takes that connection's identity: its accent colour (`data-scope="<type>"` on the container sets `--accent`),
its badge, its name in the page title (`document.title = "Name · OpenETL Lens"`), and only its own tables. Buttons, focus rings, selected rows and links use `--accent`.
Nothing from other connections is visible inside the scoped view except the sidebar list.

## Screens
1. Shell: slim top bar (brand "OpenETL Lens" on the left, a quiet "Highlights" link on the right), a left sidebar 272 px wide, content on the right.
   Sidebar: heading "Your data", one row per connection (badge, name, small status dot), the open one highlighted with its accent tint, and a primary button "Add data" pinned at the top of the list.
   Under 800 px the sidebar becomes a horizontally scrolling strip above the content.
2. Home `#home`: title "Your data". A grid of connection tiles: badge, name, "12 tables" or "1,000 records", status. Click opens the connection. Empty state: "No data connected yet. Add a database to start browsing." with the Add data button.
3. Connection `#c/<id>` (scoped). A header with large badge, name, the masked summary (host and database), a status line ("Connected" / the error), and two actions: "Test" and "Delete" (no Delete for built-in connections;
   explain with text "Built in" instead). Below it, the tables: a left list of tables (name and count) like Metabase's Browse data, and to the right the data grid for the chosen table with a search box "Search in <table>…".
   For relata add a switch "Browse | Query" (the SQL console). Table names come from `/api/c/:id/containers`.
4. Data grid: sticky header, comfortable row height, first 8 columns, ids in the monospace face, long text clamped to 2 lines, numbers right-aligned with tabular-nums, row hover tint, click or Enter opens the row in a drawer on the right
   (not a centred modal) with every field, the full text, and for markdown tables the parsed grid and line charts. Infinite scroll, page size 100, bounded to 3,000 mounted rows, exactly as API_CONTRACT.md says.
   If a long value is cut ("…") and the row has `__ref`, the drawer fetches the whole record from `GET /api/c/:id/row?container=NAME&ref=REF` (response `{ "row": {...} }`); if that endpoint is missing, just show what you have with a note.
5. Add data dialog (opened from the sidebar button or the home empty state): step 1 pick a type from six tiles (badge, name, one-line blurb); step 2 the fields for that type (from `typeMeta.js`), "Test connection" shows a result inline
   (green "Connected. Found 3 tables." or the error text in plain words), "Save" stays disabled until a test has passed, Back and Cancel always work. After saving, go straight to the new connection.
6. Delete dialog: "Delete <name>?" and the sentence "This removes the connection from Lens. Your data is not touched." Buttons: Cancel, Delete (destructive style). Never use window.confirm. After deleting, return to Home and show a toast "<name> deleted".
7. Highlights `#highlights`: the existing seven charts from `/api/insights`, moved off the main path. Keep them simple.

## Visual direction (from the frontend-design skill, specific to this brief)
- Calm, light, airy: canvas `--canvas`, surfaces `--surface`, hairline `--line` borders, almost no shadow (only dialogs, drawer and menus use `--shadow-pop`). No gradients. No card piles with identical shadows.
- Type: `--font-ui` throughout, one size scale from tokens, sentence case, no all-caps labels, no letter-spaced eyebrows, no middle-dot meta strings, no arrows appended to buttons. Monospace only for ids, URLs and SQL.
- Colour: neutral everywhere; the connection accent is the only strong colour on screen. Status uses `--ok`, `--warn`, `--bad` with their soft backgrounds.
- Motion: only in answer to an action (drawer slides in, dialog fades, toast appears). 150 ms, transform and opacity only, never `transition: all`, all of it off under `prefers-reduced-motion` (tokens.css already zeroes durations).
- Copy: plain words, active voice, buttons say what happens ("Add data", "Test connection", "Save", "Delete"). Errors say what went wrong and how to fix it. Empty states invite the next step.

## Quality floor
Keyboard reachable everywhere, visible `:focus-visible` rings, labels on every field, `aria-label` on icon-only buttons, `aria-live="polite"` for test results and toasts, dialogs trap focus and close on Escape,
`overscroll-behavior: contain` in dialogs and the drawer, works at 400 px wide with no horizontal page scroll, dark mode through the tokens, `font-variant-numeric: tabular-nums` on counts.
Performance: memoized rows, `content-visibility: auto`, passive listeners, one request in flight, abort stale requests, no layout reads in render.
