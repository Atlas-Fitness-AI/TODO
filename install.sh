#!/bin/bash
# Install/update the todo skill for Claude Code

SKILL_DIR="$HOME/.claude/skills/todo"

mkdir -p "$SKILL_DIR/templates"

cp SKILL.md "$SKILL_DIR/SKILL.md"
cp templates/TODO.md "$SKILL_DIR/templates/TODO.md"
cp templates/TODORULES.md "$SKILL_DIR/templates/TODORULES.md"
cp templates/DONE.md "$SKILL_DIR/templates/DONE.md"

# Save the dashboard path so /todo dashboard can find it
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_DIR="$REPO_DIR/dashboard"
if [ -d "$DASHBOARD_DIR" ]; then
  mkdir -p "$HOME/.claudedo"
  echo "$DASHBOARD_DIR" > "$HOME/.claudedo/dashboard-path"
  echo "Dashboard path saved to ~/.claudedo/dashboard-path"
fi

echo "Todo skill installed to $SKILL_DIR"
