import React from "react";
import { ActionIcon, Anchor, Group, Kbd, Text, Tooltip } from "@mantine/core";
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
import Logo from "./Logo.jsx";

export const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "") ? "Cmd" : "Ctrl";

// The open/close button is always visible, so nobody has to hunt for it.
export function SidebarToggle({ open, onToggle, tooltipPosition = "right" }) {
  const label = open ? "Close sidebar" : "Open sidebar";
  const Icon = open ? IconLayoutSidebarLeftCollapse : IconLayoutSidebarLeftExpand;
  return (
    <Tooltip label={<Group gap={6} wrap="nowrap">{label}<Kbd size="xs">{MOD} B</Kbd></Group>} position={tooltipPosition} withinPortal>
      <ActionIcon variant="subtle" color="gray" size="lg" onClick={onToggle} aria-label={label} aria-expanded={open} aria-controls="lens-sidebar">
        <Icon size={20} stroke={1.6} aria-hidden="true" />
      </ActionIcon>
    </Tooltip>
  );
}

// Open: logo and name on the left, toggle on the right.
export default function SidebarHeader({ open, onToggle }) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Anchor href="#home" underline="never" c="inherit" aria-label="OpenETL Lens, home">
        <Group gap="sm" wrap="nowrap">
          <Logo size={30} />
          <Text fw={650} fz="md" lh={1.2} span>OpenETL Lens</Text>
        </Group>
      </Anchor>
      <SidebarToggle open={open} onToggle={onToggle} tooltipPosition="bottom" />
    </Group>
  );
}
