---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

## OpenETL Lens notes (project addition, not part of the upstream skill)
- The upstream skill fetches its rules from a URL at review time. For this project the rules are saved locally in upstream/command.md (fetched on 2026-10-27); read that file instead of fetching.
- Rules that matter most for Lens: icon-only buttons need aria-label; visible :focus-visible on everything; buttons for actions and links for navigation; destructive actions need a confirmation dialog built in the page (never window.confirm); URL (hash) reflects state; tabular-nums for counts; long lists use content-visibility; honor prefers-reduced-motion; no transition: all; overscroll-behavior: contain in dialogs and drawers; handle empty, short and very long content.
- Output of a review is terse file:line findings, as the rules describe.

# Web Interface Guidelines

Review UI code against the Vercel Web Interface Guidelines. The rules are not stored in this repository (the upstream project states no licence).
Run `scripts/fetch-skills.sh` to download them to `upstream/command.md`, read that file, check the files you are given against every rule, and report findings as terse `file:line` lines.
