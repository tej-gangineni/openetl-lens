import React, { useState } from "react";
import { Affix, Anchor, Center, Group, Kbd, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { useHover, useMediaQuery } from "@mantine/hooks";
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
import Logo from "./Logo.jsx";

export const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "") ? "Cmd" : "Ctrl";

// The logo and the sidebar toggle share one spot. At rest it shows the logo; on hover or keyboard focus (and always on
// touch screens) it shows the open/close icon. In the sidebar the wordmark sits beside it.
export default function LogoToggle({ open, onToggle, wordmark = false, fixed = false }) {
  const { hovered, ref } = useHover();
  const [focused, setFocused] = useState(false);
  const touch = useMediaQuery("(hover: none)");
  const showIcon = hovered || focused || touch;
  const label = open ? "Close sidebar" : "Open sidebar";
  const Icon = open ? IconLayoutSidebarLeftCollapse : IconLayoutSidebarLeftExpand;
  const button = (
    <Tooltip label={<Group gap={6} wrap="nowrap">{label}<Kbd size="xs">{MOD} B</Kbd></Group>} position="right" withinPortal>
      <UnstyledButton
        ref={ref}
        type="button"
        onClick={onToggle}
        onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
        onBlur={() => setFocused(false)}
        aria-label={label}
        aria-expanded={open}
        aria-controls="lens-sidebar"
        w={36}
        h={36}
        flex="none"
        bd={showIcon ? "1px solid var(--mantine-color-default-border)" : "1px solid transparent"}
        bdrs="md"
      >
        <Center w="100%" h="100%">
          {showIcon ? <Icon size={22} stroke={1.6} aria-hidden="true" /> : <Logo size={28} />}
        </Center>
      </UnstyledButton>
    </Tooltip>
  );
  if (fixed) return <Affix position={{ top: 16, left: 16 }} zIndex={200}>{button}</Affix>;
  return (
    <Group gap="sm" wrap="nowrap">
      {button}
      {wordmark && (
        <Anchor href="#home" underline="never" c="inherit" fw={650} fz="md" lh={1.2}>
          <Text component="span" inherit>OpenETL Lens</Text>
        </Anchor>
      )}
    </Group>
  );
}
