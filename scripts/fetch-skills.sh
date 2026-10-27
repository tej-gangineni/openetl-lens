#!/usr/bin/env bash
# Download the upstream files of the four design skills into .claude/skills/<name>/upstream/ (not committed).
# Sources: github.com/anthropics/skills (frontend-design), github.com/vercel-labs/agent-skills + web-interface-guidelines, github.com/mantinedev/skills (mantine-form),
# github.com/manutej/luxor-claude-marketplace (ux-principles) and the Mantine docs at mantine.dev/llms.txt (saved as per-page .md files).
set -euo pipefail
cd "$(dirname "$0")/../.claude/skills"
dl() { local repo=$1 dir=$2 name=$3; shift 3; mkdir -p "$name/upstream"
  for f in "$@"; do curl -sfL "https://raw.githubusercontent.com/$repo/main/$dir/$f" -o "$name/upstream/$f" && echo "ok  $name/$f"; done; }
dl anthropics/skills skills/frontend-design frontend-design SKILL.md LICENSE.txt
dl vercel-labs/agent-skills skills/web-design-guidelines web-design-guidelines SKILL.md
dl vercel-labs/web-interface-guidelines . web-design-guidelines command.md
dl vercel-labs/agent-skills skills/react-best-practices react-best-practices SKILL.md AGENTS.md README.md metadata.json
dl vercel-labs/agent-skills skills/composition-patterns composition-patterns SKILL.md AGENTS.md README.md metadata.json

dl mantinedev/skills skills/mantine-form mantine-form SKILL.md references/api.md references/patterns.md 2>/dev/null || {
  mkdir -p mantine-form/upstream/references
  for f in SKILL.md references/api.md references/patterns.md; do curl -sfL "https://raw.githubusercontent.com/mantinedev/skills/master/skills/mantine-form/$f" -o "mantine-form/upstream/$f" && echo "ok  mantine-form/$f"; done; }
mkdir -p ux-principles/upstream
for f in SKILL.md README.md EXAMPLES.md; do curl -sfL "https://raw.githubusercontent.com/manutej/luxor-claude-marketplace/main/plugins/luxor-design-toolkit/skills/ux-principles/$f" -o "ux-principles/upstream/$f" && echo "ok  ux-principles/$f"; done
# Mantine documentation pages named in .claude/skills/mantine-ui/SKILL.md
mkdir -p mantine-ui/docs
curl -sfL https://mantine.dev/llms.txt -o /tmp/mantine-llms.txt
for slug in $(grep -oE 'llms/(core|hooks|charts|x|theming|styles|guides)-[a-z0-9-]+\.md|llms/getting-started\.md' /tmp/mantine-llms.txt | sed 's#llms/##; s#\.md##' | sort -u); do
  curl -sfL "https://mantine.dev/llms/$slug.md" -o "mantine-ui/docs/$slug.md" || true
done
echo "mantine docs: $(ls mantine-ui/docs | wc -l) pages"
