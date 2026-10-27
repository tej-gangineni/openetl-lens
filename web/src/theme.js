import { createTheme } from "@mantine/core";

// The only styling in the app: Mantine's theme. No stylesheets of our own.
export const theme = createTheme({
  primaryColor: "indigo",
  defaultRadius: "md",
  fontFamily: "Avenir Next, Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, sans-serif",
  fontFamilyMonospace: "ui-monospace, SF Mono, Menlo, Consolas, monospace",
  headings: { fontWeight: "600" },
  cursorType: "pointer",
  components: {
    Button: { defaultProps: { radius: "md" } },
    Modal: { defaultProps: { radius: "lg", centered: true, overlayProps: { backgroundOpacity: 0.45, blur: 2 } } },
    Drawer: { defaultProps: { position: "right", padding: "xl", overlayProps: { backgroundOpacity: 0.3 } } },
    Tooltip: { defaultProps: { withArrow: true, openDelay: 300 } },
    Table: { defaultProps: { highlightOnHover: true, verticalSpacing: "xs" } },
  },
});
