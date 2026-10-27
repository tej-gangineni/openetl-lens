import { createElement } from "react";
import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { api } from "./api.js";

// Ask first, then delete. A sample connection is only hidden (it can be restored from the home page).
export function confirmDelete(conn, onDeleted) {
  const note = conn.builtin ? " You can bring it back with Restore sample connections on the home page." : "";
  modals.openConfirmModal({
    title: `Delete ${conn.name}?`,
    children: createElement(Text, { size: "sm" }, `This removes the connection from Lens. Your data is not touched.${note}`),
    labels: { confirm: "Delete", cancel: "Cancel" },
    confirmProps: { color: "red" },
    onConfirm: async () => {
      try {
        await api(`/connections/${encodeURIComponent(conn.id)}`, { method: "DELETE" });
        onDeleted?.(conn);
      } catch (e) {
        notifications.show({ color: "red", title: `Could not delete ${conn.name}`, message: e.message });
      }
    },
  });
}
