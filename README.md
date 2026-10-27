# OpenETL Lens

A very small, Metabase-style data browser. Connect a database, test it, browse its tables and scroll its rows, delete the connection when you are done.
Read only: it never changes your data. Opening a connection gives the whole screen that connection's colour, badge and name, so it looks like that data only.

## Run
```bash
npm install          # once
npm start            # API and UI together on http://127.0.0.1:4000
npm run dev          # development: API on 4000, Vite on 5180
npm run build        # rebuild web/dist after changing web/src
```
Settings live in `.env` (see `.env.example`). The six built-in connections point at the OpenETL data lab (`../openetl-data-lab`): PostgreSQL, MongoDB, ClickHouse,
Elasticsearch, Qdrant and Relata. Add your own from the **Add data** button; they are saved in `connections.json` (private file, not committed). Any connection can be tested and deleted. Deleting one of the six sample connections only hides it; **Restore sample connections** on the home page brings it back. The left panel closes with the icon at the top left.

## What it can connect to
PostgreSQL, MongoDB, ClickHouse, Elasticsearch, Qdrant and Relata. Browsing works for any table, collection, index or type; it assumes nothing about column names.

## Why it never hangs
Every read is paginated and bounded (see `API_CONTRACT.md`): pages of 100 rows (200 at most), 5 second limits on every store, offsets capped at 100,000, counts capped at 10,001,
cells cut at 2,000 characters, responses capped near 2 MB, nothing loaded whole. The browser keeps at most 3,000 rows mounted and cancels stale requests.
The full record behind a cut-off row is fetched on demand when you open it.

## Folders
- `server/` Express API: `index.js` routes, `connections.js` saved and built-in connections, `stores.js` one adapter per database type, `util.js` limits and helpers.
- `web/src/` React app: `App.jsx` shell and routes, `Sidebar.jsx`, `Home.jsx`, `ConnectionView.jsx`, `Browser.jsx` (infinite-scroll grid), `Detail.jsx` (record drawer),
  `ConnectionDialogs.jsx` + `Dialog.jsx` + `Toast.jsx` (add, test, delete), `Highlights.jsx` (charts for the lab data), `tokens.css` (colours and type), `typeMeta.js` (connection types).
- `.claude/skills/` the design skills this UI was built with (see below). `lens-ui` is the project brief.
- `brand/` the logo (`logo.svg` with the name, `logo-mark.svg` alone). The same mark is `web/public/favicon.svg`.
- `API_CONTRACT.md` the API.

## Skills used to build the UI
Downloaded from the internet on 2026-10-27 and adapted with a short "OpenETL Lens notes" block each. `UPSTREAM.txt` in each skill names the source, commit and licence. The verbatim originals are not committed: run `scripts/fetch-skills.sh` to download them into each skill's `upstream/` folder.
`frontend-design` (Anthropic, Apache-2.0), `web-design-guidelines` (Vercel, no licence stated, local guidance only), `react-best-practices` and `composition-patterns` (Vercel, MIT).
`lens-ui` is our own skill that ties them to this app.
