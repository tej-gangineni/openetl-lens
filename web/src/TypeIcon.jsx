import React from "react";
import { ThemeIcon } from "@mantine/core";
import { typeOf } from "./typeMeta.js";

// The coloured two-letter mark for a connection type.
export default function TypeIcon({ type, size = 32 }) {
  const t = typeOf(type);
  return <ThemeIcon variant="light" color={t.color} size={size} radius="md" fw={700} fz={Math.round(size * 0.4)} aria-hidden="true">{t.mark}</ThemeIcon>;
}
