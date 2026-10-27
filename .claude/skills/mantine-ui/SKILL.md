---
name: mantine-ui
description: How to build OpenETL Lens screens with Mantine v9 (React 19) and no hand-written CSS. Use whenever you add or change anything in openetl-lens/web. Points at the official Mantine documentation saved locally in docs/.
---

# Building Lens with Mantine v9

Lens uses **Mantine** (mantine.dev, the open-source React component library) for every visual part. The rule of this project: **we write no CSS.**

## The no-CSS rule
- No `.css` / `.module.css` / `.scss` files of ours, no `<style>` tags, no inline `style={{ }}`, no `className` that points at our own classes, no CSS-in-JS helpers.
- Style with Mantine only: component props (`variant`, `color`, `size`, `radius`, `withBorder`, `loading`), **style props** on any component (`p`, `m`, `gap`, `w`, `h`, `miw`, `bg`, `c`, `fw`, `fz`, `ta`, `pos`, `top`, `left`, `display`, ...), layout components (`Stack`, `Group`, `Flex`, `SimpleGrid`, `Box`, `Center`, `Container`) and the theme in `web/src/theme.js`.
- The only CSS that exists is Mantine's own, imported in `main.jsx` (`@mantine/core/styles.css` and the notifications, spotlight and charts stylesheets). That is library code.
- If something seems to need CSS, look in the docs first: there is almost always a prop, a `Styles API` prop, or another component. If it truly cannot be done, leave it out and say so in your report.

## Read the local docs before using a component
The official pages (downloaded from mantine.dev/llms.txt) are in `.claude/skills/mantine-ui/docs/`. Run `scripts/fetch-skills.sh` if the folder is missing. Read the page, then use the props it lists.

| Need | Read |
|---|---|
| Page frame with a collapsible sidebar and no header | `core-app-shell.md` |
| Sidebar tree: connection, with tables nested below | `core-nav-link.md` (nested `NavLink`, `opened`, `childrenOffset`), `core-collapse.md` |
| Data grid | `core-table.md`, `core-scroll-area.md`, `core-skeleton.md` |
| Row detail panel | `core-drawer.md`, `core-tabs.md`, `core-code.md`, `core-copy-button.md`, `core-highlight.md` |
| Dialogs and confirmation | `core-modal.md`, `x-modals.md` (`modals.openConfirmModal`) |
| Toasts | `x-notifications.md` |
| Command palette | `x-spotlight.md` |
| Forms | the `mantine-form` skill, `core-text-input.md`, `core-password-input.md`, `core-textarea.md` |
| Buttons, icons, menus | `core-button.md`, `core-action-icon.md`, `core-unstyled-button.md`, `core-menu.md`, `core-tooltip.md`, `core-kbd.md` |
| Status, labels | `core-badge.md`, `core-indicator.md`, `core-theme-icon.md`, `core-alert.md` |
| Charts | `charts-getting-started.md`, `charts-bar-chart.md`, `charts-line-chart.md`, `charts-sparkline.md` |
| Hooks | `hooks-use-hover.md`, `hooks-use-intersection.md`, `hooks-use-hotkeys.md`, `hooks-use-local-storage.md`, `hooks-use-debounced-value.md`, `hooks-use-disclosure.md`, `hooks-use-clipboard.md`, `hooks-use-media-query.md` |
| Theme, colours, dark mode, style props | `theming-theme-object.md`, `theming-colors.md`, `theming-color-schemes.md`, `styles-style-props.md`, `styles-responsive.md` |
| Vite setup | `guides-vite.md`, `getting-started.md` |

Icons come from `@tabler/icons-react` (the set Mantine's docs use).

## Facts
- Mantine **9.x needs React 19**. Packages in use: `@mantine/core`, `hooks`, `form`, `modals`, `notifications`, `spotlight`, `charts` (with `recharts`).
- Colour per connection type is a Mantine palette name in `web/src/typeMeta.js` (`blue`, `green`, `yellow`, `teal`, `red`, `violet`). Pass it as `color`.
- Providers (`MantineProvider`, `ModalsProvider`, `Notifications`) are already in `main.jsx`. Use `useMantineColorScheme` for the light/dark switch.
