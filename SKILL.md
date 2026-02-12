---
name: todo
description: Manage project TODO items with strict documentation standards. Use when working with TODO.md, discussing tasks/bugs/features, or when the user mentions todos, work items, or task tracking.
argument-hint: [add|done|next|stuck|status|scan|init]
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

Copy the templates into the project root:
- Read `~/.claude/skills/todo/templates/TODORULES.md` and write it to `./TODORULES.md`
- Read `~/.claude/skills/todo/templates/TODO.md` and write it to `./TODO.md`
- Ask the user for the project name and update the `> Project:` line
- Tell the user to customize `TODORULES.md` for their project (categories, archive behavior, etc.)

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
