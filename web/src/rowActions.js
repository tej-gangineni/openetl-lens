import { createElement } from "react";
import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { api, postJson } from "./api.js";

const plural = (n, one, many) => `${new Intl.NumberFormat("en-US").format(n)} ${n === 1 ? one : many}`;

// Deleting rows is off for every connection until it is switched on here.
export function confirmEnableDelete(conn, onDone) {
  modals.openConfirmModal({
    title: `Allow deleting rows in ${conn.name}?`,
    children: createElement(Text, { size: "sm" }, "You will be able to select rows in any table and delete them. A delete cannot be undone. You can switch this off again from the same menu."),
    labels: { confirm: "Allow deleting", cancel: "Cancel" },
    confirmProps: { color: "red" },
    onConfirm: () => setDelete(conn, true, onDone),
  });
}

export async function setDelete(conn, writable, onDone) {
  try {
    await api(`/connections/${encodeURIComponent(conn.id)}/writable`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ writable }) });
    await onDone?.();
    notifications.show({ color: writable ? "orange" : "green", message: writable ? `Deleting rows is on for ${conn.name}` : `Deleting rows is off for ${conn.name}` });
  } catch (e) {
    notifications.show({ color: "red", title: "Could not change that", message: e.message });
  }
}

// Ask first, then delete the selected rows. onDone(deletedCount) runs after the server confirms.
export function confirmDeleteRows({ conn, table, refs, onDone }) {
  modals.openConfirmModal({
    title: `Delete ${plural(refs.length, "row", "rows")}?`,
    children: createElement(Text, { size: "sm" }, `${plural(refs.length, "row", "rows")} will be removed from ${table} in ${conn.name}. This cannot be undone.`),
    labels: { confirm: `Delete ${plural(refs.length, "row", "rows")}`, cancel: "Cancel" },
    confirmProps: { color: "red" },
    onConfirm: async () => {
      const id = `del-${Date.now()}`;
      notifications.show({ id, loading: true, message: "Deleting…", autoClose: false, withCloseButton: false });
      try {
        let deleted = 0;
        for (let i = 0; i < refs.length; i += 200) {
          deleted += (await postJson(`/c/${encodeURIComponent(conn.id)}/rows/delete`, { container: table, refs: refs.slice(i, i + 200) })).deleted;
        }
        notifications.update({ id, loading: false, color: "green", message: `Deleted ${plural(deleted, "row", "rows")} from ${table}`, autoClose: 4000, withCloseButton: true });
        onDone?.(deleted);
      } catch (e) {
        notifications.update({ id, loading: false, color: "red", title: "Nothing was deleted", message: e.message, autoClose: 9000, withCloseButton: true });
      }
    },
  });
}
