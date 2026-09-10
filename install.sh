#!/bin/bash
# Install/update the shared todo skill for Claude Code and Codex.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_PREFIX="$HOME"
INSTALL_TARGET="both"

usage() {
  cat <<'EOF'
Usage: install.sh [--both|--claude|--codex] [--prefix DIR]

Installs for both agents by default:
  Claude Code: <prefix>/.claude/skills/todo
  Codex:       <prefix>/.agents/skills/todo

The prefix defaults to your home directory. Use --prefix for a staged install.
The shared dashboard configuration lives at <prefix>/.atlas-todo.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --both|--claude|--codex) INSTALL_TARGET="${1#--}"; shift ;;
    --prefix)
      if [ "$#" -lt 2 ] || [ -z "$2" ] || [[ "$2" == --* ]]; then
        echo "--prefix requires a directory" >&2
        exit 1
      fi
      INSTALL_PREFIX="$2"
      shift 2
      ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
done

# Check the complete bundle before updating either installed skill.
for SOURCE in SKILL.md templates/TODO.md templates/TODORULES.md templates/DONE.md templates/AGENT-TODO.md; do
  if [ ! -f "$REPO_DIR/$SOURCE" ]; then
    echo "Missing skill resource: $REPO_DIR/$SOURCE" >&2
    exit 1
  fi
done

install_skill() {
  local agent="$1"
  local skill_dir="$2"
  mkdir -p "$skill_dir/templates"

  if [ "$agent" = "Codex" ]; then
    # Claude's command hint and tool allowlist are host-specific metadata.
    # Keep the workflow body identical for both agents.
    awk '
      /^---$/ { delimiters++ }
      delimiters == 1 && /^(argument-hint|allowed-tools):/ { next }
      { print }
    ' "$REPO_DIR/SKILL.md" > "$skill_dir/SKILL.md"
  else
    cp "$REPO_DIR/SKILL.md" "$skill_dir/SKILL.md"
  fi

  for TEMPLATE in TODO.md TODORULES.md DONE.md AGENT-TODO.md; do
    cp "$REPO_DIR/templates/$TEMPLATE" "$skill_dir/templates/$TEMPLATE"
  done
  echo "$agent TODO skill installed to $skill_dir"
}

if [ "$INSTALL_TARGET" = "both" ] || [ "$INSTALL_TARGET" = "claude" ]; then
  install_skill "Claude Code" "$INSTALL_PREFIX/.claude/skills/todo"
fi
if [ "$INSTALL_TARGET" = "both" ] || [ "$INSTALL_TARGET" = "codex" ]; then
  install_skill "Codex" "$INSTALL_PREFIX/.agents/skills/todo"
fi

# Migrate config from older locations (one-time)
CONFIG_DIR="$INSTALL_PREFIX/.atlas-todo"
for OLD in "$INSTALL_PREFIX/.todo" "$INSTALL_PREFIX/.claudedo"; do
  if [ -d "$OLD" ] && [ ! -d "$CONFIG_DIR" ]; then
    mv "$OLD" "$CONFIG_DIR"
    echo "Migrated config from $OLD to $CONFIG_DIR"
  fi
done

# Save the dashboard path so /todo dashboard can find it
DASHBOARD_DIR="$REPO_DIR/dashboard"
if [ -d "$DASHBOARD_DIR" ]; then
  mkdir -p "$CONFIG_DIR"
  echo "$DASHBOARD_DIR" > "$CONFIG_DIR/dashboard-path"
  echo "Dashboard path saved to $CONFIG_DIR/dashboard-path"

  # The `todo` command (team sync) runs the dashboard's CLI with bun.
  mkdir -p "$CONFIG_DIR/bin"
  {
    echo '#!/bin/bash'
    echo '# Installed by TODO install.sh. Runs the team sync CLI from the dashboard checkout.'
    echo "DASH=\"\$(cat \"$CONFIG_DIR/dashboard-path\" 2>/dev/null)\""
    echo 'if [ -z "$DASH" ] || [ ! -f "$DASH/cli/todo.ts" ]; then'
    echo '  echo "todo: dashboard not found; run ./install.sh from the TODO repo" >&2'
    echo '  exit 1'
    echo 'fi'
    echo 'if ! command -v bun >/dev/null 2>&1; then'
    echo '  echo "todo: bun is required (https://bun.sh)" >&2'
    echo '  exit 1'
    echo 'fi'
    echo 'exec bun run "$DASH/cli/todo.ts" "$@"'
  } > "$CONFIG_DIR/bin/todo"
  chmod +x "$CONFIG_DIR/bin/todo"
  echo "todo command installed to $CONFIG_DIR/bin/todo"

  if [ -f "$DASHBOARD_DIR/package.json" ] && command -v bun >/dev/null 2>&1; then
    (cd "$DASHBOARD_DIR" && bun install --silent) && echo "Dashboard dependencies installed"
  fi
fi
