#!/usr/bin/env bash
# Download the upstream files of the four design skills into .claude/skills/<name>/upstream/ (not committed).
# Sources: github.com/anthropics/skills (frontend-design) and github.com/vercel-labs/agent-skills + web-interface-guidelines.
set -euo pipefail
cd "$(dirname "$0")/../.claude/skills"
dl() { local repo=$1 dir=$2 name=$3; shift 3; mkdir -p "$name/upstream"
  for f in "$@"; do curl -sfL "https://raw.githubusercontent.com/$repo/main/$dir/$f" -o "$name/upstream/$f" && echo "ok  $name/$f"; done; }
dl anthropics/skills skills/frontend-design frontend-design SKILL.md LICENSE.txt
dl vercel-labs/agent-skills skills/web-design-guidelines web-design-guidelines SKILL.md
dl vercel-labs/web-interface-guidelines . web-design-guidelines command.md
dl vercel-labs/agent-skills skills/react-best-practices react-best-practices SKILL.md AGENTS.md README.md metadata.json
dl vercel-labs/agent-skills skills/composition-patterns composition-patterns SKILL.md AGENTS.md README.md metadata.json
