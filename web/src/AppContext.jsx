import { createContext, useContext } from "react";

// What the shell shares with the pages. The shell (App.jsx) provides it; pages read it with useApp().
//   conns            [{ id, name, type, summary, builtin }] or null while loading
//   hiddenDefaults   how many sample connections are hidden
//   status(id)       "up" | "down" | "unknown"
//   getTables(id)    { status: "idle" | "loading" | "ok" | "error", items: [{ name, count }], error }  (the sidebar tree loads it when a connection opens)
//   loadTables(id, { force })   start loading the tables of a connection (no-op if already loaded unless force)
//   refresh()        reload connections, their status and the loaded tables
//   openAdd()        open the Add data dialog
//   requestDelete(conn)   confirm, delete, then go Home with a notification (calls confirmDelete from confirmDelete.js)
//   restore()        bring back the hidden sample connections
//   sidebarOpen, toggleSidebar()
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
