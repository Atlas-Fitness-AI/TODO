#!/bin/bash
# Install/update the todo skill for Claude Code

SKILL_DIR="$HOME/.claude/skills/todo"

mkdir -p "$SKILL_DIR/templates"

cp SKILL.md "$SKILL_DIR/SKILL.md"
cp templates/TODO.md "$SKILL_DIR/templates/TODO.md"
cp templates/TODORULES.md "$SKILL_DIR/templates/TODORULES.md"
cp templates/DONE.md "$SKILL_DIR/templates/DONE.md"

echo "Todo skill installed to $SKILL_DIR"
