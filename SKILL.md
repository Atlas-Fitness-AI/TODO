---
name: todo
description: Manage project TODO items with strict documentation standards. Use when working with TODO.md, discussing tasks/bugs/features, or when the user mentions todos, work items, or task tracking.
argument-hint: [add|done|next|stuck|status|scan|init|update|help]
allowed-tools: Read, Write, Edit, Glob, Grep
---

# TODO Manager

You manage a structured TODO system for this project. Every action must follow the rules in the project's `TODORULES.md`.

## First: Load Context

1. Read `TODORULES.md` in the project root. If it doesn't exist, suggest running `/todo init`.
2. Read `TODO.md` in the project root. If it doesn't exist, suggest running `/todo init`.
3. If archiving is enabled in TODORULES.md, check for the archive file (default: `DONE.md`).

## Commands

Route based on `$ARGUMENTS`:

### `init` - Initialize TODO System

Check for existing files before doing anything:

**If `TODO.md` already exists with content (migration):**
1. Read the existing TODO.md in full.
2. Read `~/.claude/skills/todo/templates/TODORULES.md` and write it to `./TODORULES.md` (rules are always fresh).
3. Parse the existing TODO.md and extract every item you can identify — look for headings, bullet points, checkboxes, status markers, or any structured/unstructured tasks.
4. For each extracted item, map it to the structured format:
   - Infer priority from keywords (e.g. "critical", "high priority", "low"), existing priority labels, or position/context. Default to `Medium` if unclear.
   - Infer category from content (mentions of UI, database, API, etc.). Ask the user if ambiguous.
   - Infer status from markers like `[x]` (Done), "Status: Fixed" (Done), "in progress" (In Progress), "blocked" (Stuck). Default to `Ready` for unmarked items.
   - Preserve all existing detail — file references, descriptions, context, solutions — mapping them to the correct fields.
5. Write the new structured TODO.md with all migrated items in their proper status sections.
6. Show the user a summary of what was migrated: count by status, any items that need manual review (ambiguous priority/category).
7. Ask the user to review and adjust anything that was inferred incorrectly.

**If `TODO.md` does not exist (fresh start):**
1. Read `~/.claude/skills/todo/templates/TODORULES.md` and write it to `./TODORULES.md`
2. Read `~/.claude/skills/todo/templates/TODO.md` and write it to `./TODO.md`
3. Ask the user for the project name and update the `> Project:` line.

**Always (after creating/migrating files):**
- Add a TODO system section to the project's `CLAUDE.md`. If `CLAUDE.md` doesn't exist, create it with just this section. If it already exists, append this section (don't overwrite existing content). The section should look like:

```markdown
## TODO System

This project uses a structured TODO system. Tasks, bugs, and features are tracked in `TODO.md` with rules defined in `TODORULES.md`.

Use the `/todo` skill to manage items:
- `/todo` or `/todo status` — overview of all items
- `/todo add [description]` — add a new item (bugs, features, tasks)
- `/todo done [item]` — mark an item as completed
- `/todo next` — pick the highest-priority item to work on
- `/todo stuck [item]` — mark an item as blocked
- `/todo scan` — find inline TODO comments in code and sync them

When the user mentions tasks, bugs, features, or work items, suggest using `/todo` to keep everything tracked and documented.
```

- Tell the user to customize `TODORULES.md` for their project (categories, archive behavior, etc.).

### `update` - Refresh Skill Templates

Use this when the todo skill itself has been updated and you want to pull in the latest templates without losing existing TODO items.

**Refresh TODORULES.md:**
1. Read `~/.claude/skills/todo/templates/TODORULES.md` (the latest template).
2. Read the project's current `./TODORULES.md`.
3. Extract any project-specific customizations from the current file:
   - **Project-Specific Categories**: Any categories added under that section.
   - **Config overrides**: Current `archive` and `archive_file` values.
4. Write the fresh template to `./TODORULES.md`, then re-apply the extracted customizations:
   - Re-insert project-specific categories under the "Project-Specific Categories" section.
   - Restore the project's config values in the yaml block.
5. Show the user what changed: summarize any new sections, updated rules, or structural changes between the old and new template.

**Audit existing TODO.md for compatibility:**
6. Read the current `TODO.md` and parse all existing items.
7. Compare each item against the updated TODORULES.md and check for:
   - **Missing required fields**: New required fields that existing items don't have.
   - **Invalid categories**: Items using categories that were removed or renamed.
   - **Invalid priorities**: Priority values that don't match the current valid set.
   - **Format mismatches**: Items not following the current expected format (e.g., field ordering, label formatting).
   - **Status section changes**: Items in sections that may have been renamed or restructured.
8. Report a summary of issues found:
   - Count of items that are fully compatible (no changes needed).
   - Count of items with issues, grouped by issue type.
   - For each issue, show the item title and what needs to change.
9. Ask the user if they want to auto-fix the flagged items. If yes:
   - Add missing fields with sensible defaults (ask the user when a default isn't obvious).
   - Update invalid categories/priorities (ask the user to pick replacements).
   - Reformat items to match the current structure.
10. Remind the user to review `TODORULES.md` in case new options were added that they may want to customize.

**Ensure CLAUDE.md is up to date:**
11. Check if the project's `CLAUDE.md` contains a `## TODO System` section.
    - If missing entirely: append the TODO System section (same content as the `init` command writes).
    - If present but outdated (doesn't match the current template): replace the `## TODO System` section with the latest version, preserving all other CLAUDE.md content.
    - If present and current: no changes needed.

### `add` - Add a TODO Item

Gather information and enforce documentation standards:

1. Parse what the user provided after `add`. If sparse, ask for details.
2. Determine the item type from context:
   - **Bug**: Something broken. REQUIRE: Files with line numbers, Context/root cause.
   - **Feature**: New functionality. REQUIRE: Acceptance criteria.
   - **Task**: Refactor, chore, improvement. REQUIRE: Description of what and why.
3. Enforce required fields per TODORULES.md:
   - Title (imperative mood: "Fix...", "Add...", "Refactor...")
   - Priority: `Critical` | `High` | `Medium` | `Low`
   - Category: From the project's category list in TODORULES.md
   - Description: 1-3 sentences, actionable
4. Add conditional fields based on type (see above).
5. Default status: **Ready** (or **Backlog** if missing required info).
6. Insert the item into the correct status section in TODO.md, ordered by priority within the section (Critical first).

Item format:
```markdown
### [Title]
- **Priority**: [level]
- **Category**: [tags]
- **Files**: `path/to/file.tsx:42`, `path/to/other.ts:15`
- **Description**: What needs to happen.
- **Context**: Root cause or background (bugs).
- **Acceptance**: How to verify completion (features).
- **Added**: [today's date]
```

Omit fields that don't apply (don't include empty fields).

### `done` - Complete a TODO Item

1. Identify the item. If `$ARGUMENTS` after "done" is ambiguous, list matching items and ask.
2. Ask for a brief resolution note (what was done).
3. Add `- **Completed**: [today's date]` and `- **Resolution**: [note]` to the item.
4. Check TODORULES.md archive config:
   - If `archive: true`: Move the item to the archive file (default `DONE.md`). Create the file from template if it doesn't exist.
   - If `archive: false`: Move the item to the `## Done` section at the bottom of TODO.md.
5. Check referenced files for related `// TODO:` comments. If found, offer to remove them.

### `next` - Pick Next Task

1. Look at items in the **Ready** section only.
2. Sort by priority: Critical > High > Medium > Low.
3. Present the highest-priority item with full details.
4. Ask if the user wants to start working on it.
5. If yes: Move to **In Progress**, add `- **Started**: [today's date]`.

### `stuck` - Mark as Blocked

1. Identify the item (should be In Progress). If ambiguous, ask.
2. Require a reason: what's blocking progress.
3. Move to **Stuck** section.
4. Add `- **Blocked**: [reason]`.
5. If possible, suggest ways to unblock.

### `status` - Overview (also the default when no args)

Display a summary:

```
## TODO Status

**In Progress** (N items)
- [Title] - [Priority] - [Category] - started [date]

**Stuck** (N items)
- [Title] - [Priority] - Blocked: [reason]

**Ready** (N items, showing top 5)
- [Title] - [Priority] - [Category]

**Backlog** (N items)

**Done** (N items total)
```

Focus attention on In Progress and Stuck items first.

### `scan` - Find Inline TODOs

1. Use Grep to search for `// TODO:`, `# TODO:`, `<!-- TODO:`, and `// FIXME:` patterns across the codebase.
2. Exclude `node_modules`, `.git`, `dist`, `build`, `.next`, `vendor` directories.
3. For each found comment:
   - Show the file, line number, and comment text.
   - Check if it's already tracked in TODO.md (match by file reference).
4. For untracked TODOs, offer to add them to TODO.md with proper documentation.
5. For tracked TODOs that no longer exist in code, flag them as potentially stale.

### `help` - Show Available Commands

Display this quick reference:

```
/todo               Show status overview (same as /todo status)
/todo add [desc]    Add a new TODO item with enforced documentation
/todo done [item]   Mark an item as completed and archive it
/todo next          Pick the highest-priority Ready item to work on
/todo stuck [item]  Mark an item as blocked with a reason
/todo status        Overview of all items by status
/todo scan          Find inline // TODO comments and sync with TODO.md
/todo init          Initialize TODO system (or migrate existing TODO.md)
/todo update        Refresh TODORULES.md template and audit items
/todo help          Show this reference

Updating the skill:
  After pulling updates from the todo skill repo, run ./install.sh
  to sync the latest version to ~/.claude/skills/todo/
```

## Formatting Rules

When editing TODO.md:
- Keep `---` separators between status sections.
- Items within a section are ordered by priority (Critical > High > Medium > Low).
- Remove empty status sections only if they've never had items. Keep section headers for sections that are just currently empty.
- Maintain consistent field formatting (bold labels, backtick file paths).
- Dates use YYYY-MM-DD format.
- File paths must be relative to project root with line numbers where applicable.

## Validation

Before writing any todo item, verify:
- [ ] File references point to real files (use Glob to check).
- [ ] Title is imperative mood ("Fix", "Add", "Refactor", not "Fixing", "Added").
- [ ] Priority is one of the valid levels.
- [ ] Category matches the project's TODORULES.md list.
- [ ] Bugs have file references and context.
- [ ] Features have acceptance criteria.
