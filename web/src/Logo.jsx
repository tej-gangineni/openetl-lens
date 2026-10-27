import React from "react";
import { useComputedColorScheme, useMantineTheme } from "@mantine/core";

// The OpenETL Lens mark: a lens over three rows of data, the top row picked out in the brand colour.
export default function Logo({ size = 28 }) {
  const theme = useMantineTheme();
  const dark = useComputedColorScheme("light") === "dark";
  const brand = dark ? theme.colors.indigo[3] : theme.colors.indigo[7];
  const ink = dark ? theme.colors.dark[0] : theme.colors.dark[8];
  const face = dark ? theme.colors.dark[7] : "#ffffff";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="14" cy="14" r="10.2" fill={face} stroke={ink} strokeWidth="2.4" />
      <rect x="8.6" y="9.1" width="10.8" height="2.7" rx="1.35" fill={brand} />
      <rect x="8.6" y="13.2" width="7.4" height="2.7" rx="1.35" fill={ink} opacity="0.5" />
      <rect x="8.6" y="17.3" width="9.2" height="2.7" rx="1.35" fill={ink} opacity="0.5" />
      <path d="M21.7 21.7 28 28" stroke={brand} strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}
