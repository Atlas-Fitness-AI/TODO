#!/bin/bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/todo-install.XXXXXX")"
TEST_DIR="$(cd "$TEST_DIR" && pwd)"
trap 'rm -rf "$TEST_DIR"' EXIT

assert_bundle() {
  local skill_dir="$1"
  test -s "$skill_dir/SKILL.md"
  for template in TODO.md TODORULES.md DONE.md AGENT-TODO.md; do
    cmp "$REPO_DIR/templates/$template" "$skill_dir/templates/$template"
  done
  # Both agents must receive precisely the same workflow body.
  sed '1,/^---$/d; 1,/^---$/d' "$REPO_DIR/SKILL.md" > "$TEST_DIR/source-body"
  sed '1,/^---$/d; 1,/^---$/d' "$skill_dir/SKILL.md" > "$TEST_DIR/installed-body"
  cmp "$TEST_DIR/source-body" "$TEST_DIR/installed-body"
}

# Run from a different directory, with spaces in both source and target paths.
mkdir -p "$TEST_DIR/source repo/templates" "$TEST_DIR/source repo/dashboard" "$TEST_DIR/elsewhere"
cp "$REPO_DIR/install.sh" "$REPO_DIR/SKILL.md" "$TEST_DIR/source repo/"
cp "$REPO_DIR"/templates/*.md "$TEST_DIR/source repo/templates/"
cd "$TEST_DIR/elsewhere"
bash "$TEST_DIR/source repo/install.sh" --prefix "$TEST_DIR/both agents"
assert_bundle "$TEST_DIR/both agents/.claude/skills/todo"
assert_bundle "$TEST_DIR/both agents/.agents/skills/todo"
cmp "$REPO_DIR/SKILL.md" "$TEST_DIR/both agents/.claude/skills/todo/SKILL.md"
if rg -q '^(argument-hint|allowed-tools):' "$TEST_DIR/both agents/.agents/skills/todo/SKILL.md"; then
  echo "Codex bundle contains Claude-specific frontmatter" >&2
  exit 1
fi
test "$(cat "$TEST_DIR/both agents/.atlas-todo/dashboard-path")" = "$TEST_DIR/source repo/dashboard"

# Reinstall updates stale resources and preserves the existing project registry.
printf '%s\n' '{"projects":[{"name":"Example","path":"/example"}]}' > "$TEST_DIR/both agents/.atlas-todo/config.json"
cp "$TEST_DIR/both agents/.atlas-todo/config.json" "$TEST_DIR/expected-config"
printf '%s\n' 'outdated skill' > "$TEST_DIR/both agents/.agents/skills/todo/SKILL.md"
bash "$REPO_DIR/install.sh" --both --prefix "$TEST_DIR/both agents"
assert_bundle "$TEST_DIR/both agents/.agents/skills/todo"
cmp "$TEST_DIR/expected-config" "$TEST_DIR/both agents/.atlas-todo/config.json"

for agent in claude codex; do
  bash "$REPO_DIR/install.sh" "--$agent" --prefix "$TEST_DIR/$agent"
done
assert_bundle "$TEST_DIR/claude/.claude/skills/todo"
test ! -e "$TEST_DIR/claude/.agents"
assert_bundle "$TEST_DIR/codex/.agents/skills/todo"
test ! -e "$TEST_DIR/codex/.claude"

for legacy in .todo .claudedo; do
  prefix="$TEST_DIR/migration-$legacy"
  mkdir -p "$prefix/$legacy"
  cp "$TEST_DIR/expected-config" "$prefix/$legacy/config.json"
  bash "$REPO_DIR/install.sh" --codex --prefix "$prefix"
  cmp "$TEST_DIR/expected-config" "$prefix/.atlas-todo/config.json"
  test ! -e "$prefix/$legacy"
done

# Current configuration takes precedence over a legacy directory.
mkdir -p "$TEST_DIR/both agents/.todo"
printf '%s\n' 'legacy sentinel' > "$TEST_DIR/both agents/.todo/config.json"
bash "$REPO_DIR/install.sh" --prefix "$TEST_DIR/both agents"
cmp "$TEST_DIR/expected-config" "$TEST_DIR/both agents/.atlas-todo/config.json"
test "$(cat "$TEST_DIR/both agents/.todo/config.json")" = 'legacy sentinel'

if bash "$REPO_DIR/install.sh" --prefix; then
  echo "Missing prefix was accepted" >&2
  exit 1
fi
if bash "$REPO_DIR/install.sh" --unknown; then
  echo "Unknown option was accepted" >&2
  exit 1
fi

# An incomplete source bundle must fail before modifying an installed skill.
mv "$TEST_DIR/source repo/templates/DONE.md" "$TEST_DIR/saved-DONE.md"
if bash "$TEST_DIR/source repo/install.sh" --prefix "$TEST_DIR/incomplete"; then
  echo "Incomplete bundle was installed" >&2
  exit 1
fi
test ! -e "$TEST_DIR/incomplete"

echo "Installer checks passed."
