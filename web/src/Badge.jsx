import React from "react";
import { typeOf } from "./typeMeta.js";

// A rounded square carrying the connection type's colour and two-letter mark.
export default function TypeBadge({ type, size = "md" }) {
  const px = size === "lg" ? 44 : size === "sm" ? 24 : 32;
  return (
    <span aria-hidden="true" style={{ "--accent": `var(--c-${type})`, width: px, height: px, borderRadius: Math.round(px * 0.28), flex: "none",
      display: "inline-grid", placeItems: "center", background: "color-mix(in srgb, var(--accent) 11%, var(--surface))", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 32%, var(--line))",
      font: `600 ${Math.round(px * 0.4)}px/1 var(--font-ui)` }}>{typeOf(type).mark}</span>
  );
}
