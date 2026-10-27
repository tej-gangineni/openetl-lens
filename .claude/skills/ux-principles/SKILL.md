---
name: ux-principles
description: User research, usability heuristics, user psychology, accessibility, inclusive design, user testing, and UX metrics
category: design
tags: [ux, user-research, usability, accessibility, design-thinking, user-testing]
version: 1.0.0
---

## OpenETL Lens notes (project addition, not part of the upstream skill)
Apply these of Nielsen's heuristics to Lens, concretely:
- **Visibility of system status:** every list and panel shows a skeleton while loading, a clear error with Retry on failure, and an empty state that says what to do next. Counts say "at least 10,001" when capped.
- **Match the real world:** say "tables", "collections", "indices" per connection type (typeMeta), plain words in errors, no jargon such as "built in".
- **User control and freedom:** the sidebar closes and reopens, Escape closes every dialog and the drawer, deleting a connection asks first and says your data is not touched, sample connections can be restored.
- **Consistency:** the same action has the same name everywhere (Add data, Test connection, Delete); one place for each control.
- **Error prevention:** Save is disabled until a test passes; Delete needs confirmation.
- **Recognition over recall:** the sidebar tree shows connections and their tables; a command palette (Ctrl or Cmd + K) finds any of them; the last choice is remembered.
- **Flexibility:** keyboard shortcuts (Ctrl or Cmd + B sidebar, Ctrl or Cmd + K search, / focuses the table search) for experts; the mouse flow works for everyone.
- **Minimalist design:** only add, test, delete, browse, search, row detail.
- Fitts's and Hick's laws: the primary action (Add data) is big and at the top of the sidebar; a screen never offers more than a handful of choices.

# ux-principles

The upstream text is not stored in this repository (no licence is stated upstream). Run `scripts/fetch-skills.sh` to download it to `upstream/SKILL.md`, then read it and apply it with the notes above.
