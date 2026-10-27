import React from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider, ColorSchemeScript } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
// Mantine's own stylesheets (library code, not ours). We write no CSS.
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/spotlight/styles.css";
import "@mantine/charts/styles.css";
import { theme } from "./theme.js";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <MantineProvider theme={theme} defaultColorScheme="auto">
    <ColorSchemeScript defaultColorScheme="auto" />
    <ModalsProvider>
      <Notifications position="bottom-right" limit={4} />
      <App />
    </ModalsProvider>
  </MantineProvider>,
);
