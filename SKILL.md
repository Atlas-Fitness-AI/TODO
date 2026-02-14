---
name: todo
description: Manage project TODO items with strict documentation standards. Use when working with TODO.md, discussing tasks/bugs/features, or when the user mentions todos, work items, or task tracking.
argument-hint: [add|done|move|start|next|stuck|status|scan|dashboard|init|update|help]
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
   - Infer status from markers like `[x]` (Resolved), "Status: Fixed" (Resolved), "in progress" (Active), "blocked" (Blocked). Default to `Queued` for unmarked items.
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
- `/todo start [item]` — start working on a specific task (with briefing)
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
5. **Check for dependencies:**
   - Look at existing items in Queued, Active, Blocked, and Pending sections of TODO.md.
   - If there are existing items, list them as numbered options and ask: "Does this depend on any existing tasks?"
   - If the user selects one or more, add `- **Dependencies**: [title1], [title2]` to the item (comma-separated titles).
   - If the user says no or there are no existing items, omit the Dependencies field entirely (don't add an empty field).
6. **Steps/milestones:**
   - Assess whether the task warrants steps based on complexity: multiple files, multi-part description, refactors, features with several acceptance criteria, or tasks the user described with sequential phases.
   - **If the task is complex enough**: propose steps yourself. Present them as a numbered list and ask the user to confirm, edit, or skip. Example: "I'd suggest these steps: 1. Extract schema validation, 2. Extract query builders, 3. Add unit tests — look right?"
   - **If the task is simple** (single-file fix, quick tweak, one clear action): skip steps entirely, don't ask.
   - **If ambiguous**: ask "Does this task have steps or milestones?" and let the user decide.
   - If steps are confirmed, write as multi-line checklist under `- **Steps**:`:
     ```
     - **Steps**:
       - [ ] Step one
       - [ ] Step two
     ```
7. Default status: **Queued** (or **Pending** if missing required info).
8. Insert the item into the correct status section in TODO.md, ordered by priority within the section (Critical first).

Item format:
```markdown
### [Title]
- **Priority**: [level]
- **Category**: [tags]
- **Files**: `path/to/file.tsx:42`, `path/to/other.ts:15`
- **Description**: What needs to happen.
- **Context**: Root cause or background (bugs).
- **Acceptance**: How to verify completion (features).
- **Dependencies**: [other task titles, comma-separated]
- **Steps**:
  - [ ] Step one
  - [ ] Step two
- **Added**: [today's date]
```

Omit fields that don't apply (don't include empty fields).

### `done` - Complete a TODO Item (or Step)

**Step completion** — If `$ARGUMENTS` matches `step [text]`:
1. Find the Active task containing a step whose title matches `[text]` (partial match ok, ask if ambiguous).
2. Toggle that step to `[x]` in TODO.md.
3. Show updated progress (e.g. "3/5 steps complete").
4. If all steps are now complete, ask: "All steps complete — mark this task as resolved?"
5. If yes, continue with the full resolution flow below.

**Task completion** — Otherwise:
1. Identify the item. If `$ARGUMENTS` after "done" is ambiguous, list matching items and ask.
2. If the item has steps with incomplete entries, warn: "This task has N incomplete steps. Mark as resolved anyway?" If the user declines, stop.
3. Ask for a brief resolution note (what was done).
4. Add `- **Completed**: [today's date]` and `- **Resolution**: [note]` to the item.
5. Check TODORULES.md archive config:
   - If `archive: true`: Move the item to the archive file (default `DONE.md`). Create the file from template if it doesn't exist.
   - If `archive: false`: Move the item to the `## Resolved` section at the bottom of TODO.md.
6. Check referenced files for related `// TODO:` comments. If found, offer to remove them.

### `move` - Move Item to Any Status

Move an item directly to a specific status, handling required fields for the target.

1. Parse `$ARGUMENTS` after "move". Expect a pattern like `move [item] [status]` or `move [item] to [status]`.
   - `[item]` can be a partial title match, item number, or keyword.
   - `[status]` must be one of: `pending`, `queued`, `active` (or `in-progress`), `blocked` (or `stuck`), `resolved` (or `done`).
   - If either is ambiguous or missing, ask the user.
2. Identify the item in TODO.md. If multiple items match, list them and ask.
3. Validate the transition and gather required fields for the target status:
   - **→ Pending**: No extra fields required. Remove `Started` date if present.
   - **→ Queued**: No extra fields required. Remove `Started` date and `Blocked` reason if present.
   - **→ Active**: Add `- **Started**: [today's date]` if not already present. Remove `Blocked` reason if present.
   - **→ Blocked**: Require a `Blocked` reason — ask the user if not provided. Add `- **Blocked**: [reason]`.
   - **→ Resolved**: Require a resolution note — ask the user if not provided. Add `- **Completed**: [today's date]` and `- **Resolution**: [note]`. If archive is enabled, move to the archive file instead of the Resolved section.
4. Remove the item from its current status section.
5. Insert the item into the target status section, ordered by priority within the section.
6. Confirm the move: show the item title, old status → new status.

Status aliases (case-insensitive):
- `pending`, `backlog` → Pending
- `queued`, `ready` → Queued
- `active`, `in-progress`, `wip` → Active
- `blocked`, `stuck` → Blocked
- `resolved`, `done`, `complete`, `finished` → Resolved

### `start` - Start Working on a Specific Task

Pick a specific item and begin working on it, with a full briefing.

1. Parse `$ARGUMENTS` after "start". `[item]` can be a partial title match, item number, or keyword.
   - If ambiguous or missing, list Queued and Pending items and ask which one.
2. Identify the item in TODO.md. If multiple items match, list them and ask.
3. **Check dependencies before proceeding:**
   - If the item has a `Dependencies` field, look up each dependency title in TODO.md and DONE.md/Resolved section.
   - If any dependency is NOT resolved (i.e. still in Active, Queued, Blocked, or Pending), warn the user:
     - List each unresolved dependency with its current status (e.g. "`Setup database` is still **Queued**").
     - Ask: "This item has unresolved dependencies. Start anyway?"
   - If all dependencies are resolved (in Resolved section or DONE.md) or the item has no dependencies, proceed normally.
4. Move the item to **Active**:
   - Add `- **Started**: [today's date]` if not already present.
   - Remove `Blocked` reason if present (item was previously Blocked).
   - Remove the item from its current section and insert into **Active**, ordered by priority.
5. Display a **task briefing**:
   - Show the full item with all fields.
   - If the item has **Steps**, show step progress: "Steps: 2/5 complete" with a list of each step and its check status (`[x]` or `[ ]`). Suggest starting with the first incomplete step.
   - If the item has **Files** references, read each referenced file and summarize the relevant code around the referenced line numbers.
   - Based on the item's description, acceptance criteria, and context, suggest a concrete starting approach — what to look at first, what the likely implementation steps are, and any potential gotchas.
6. Confirm: show the item title and the status transition (e.g. Queued → Active).
7. **Auto-complete steps as you work:**
   - If the task has steps, track your progress against them as you work.
   - When you finish the work described by a step, immediately:
     1. Toggle that step to `[x]` in TODO.md.
     2. Log an activity event: `{ action: "UPDATED", title: "[task title]", detail: "Step completed: [step title]", color: "text-purple-400" }`.
     3. Briefly confirm to the user: "Marked step done: [step title] (N/M complete)".
   - Work through steps in order when possible, but if you naturally complete a later step first, mark it off then.
   - When all steps are complete, tell the user: "All steps complete — ready to mark this task as resolved?"

### `next` - Pick Next Task

1. Look at items in the **Queued** section only.
2. Sort by priority: Critical > High > Medium > Low.
3. **Factor in dependencies:**
   - For each candidate item, check if it has a `Dependencies` field.
   - If it does, look up each dependency title in TODO.md and DONE.md/Resolved to see if all are resolved.
   - Prefer items with no dependencies or all-resolved dependencies over items with unresolved dependencies.
   - If the top-priority item has unresolved dependencies, mention it (e.g. "Highest priority is `[Title]` but it has unresolved dependencies: `[dep]` (Queued)") and offer the next item that has no dependency issues instead.
4. Present the selected item with full details.
5. Ask if the user wants to start working on it.
6. If yes: Move to **Active**, add `- **Started**: [today's date]`.

### `stuck` - Mark as Blocked

1. Identify the item (should be Active). If ambiguous, ask.
2. Require a reason: what's blocking progress.
3. Move to **Blocked** section.
4. Add `- **Blocked**: [reason]`.
5. If possible, suggest ways to unblock.

### `status` - Overview (also the default when no args)

Display a summary:

```
## TODO Status

**Active** (N items)
- [Title] - [Priority] - [Category] - started [date]

**Blocked** (N items)
- [Title] - [Priority] - Blocked: [reason]

**Queued** (N items, showing top 5)
- [Title] - [Priority] - [Category]

**Pending** (N items)

**Resolved** (N items total)
```

For items with steps, append step progress to the line:
- `- [Title] - [Priority] - [Category] - steps: 2/5`

For items with dependencies, append dependency info to the line:
- `- [Title] - [Priority] - [Category] - depends on: [dep1] ✓, [dep2] ⧖`
- `✓` = dependency is resolved, `⧖` = dependency is still open (Active, Queued, Blocked, or Pending)
- Look up each dependency title in TODO.md and DONE.md/Resolved to determine its status.
- Only show this suffix for items that have a Dependencies field.

Focus attention on Active and Blocked items first.

### `dashboard` - Launch Web Dashboard

Open the ClaudeDo dashboard in the browser, starting the dev server if needed.

1. Read `~/.claudedo/dashboard-path` to find the dashboard directory.
   - If the file doesn't exist, check if `~/.claude/skills/todo/dashboard/` exists as a fallback.
   - If neither exists, tell the user: "Dashboard path not configured. Run `./install.sh` from the ClaudeDo repo to set it up."
2. Check ports 3000-3009 for an existing ClaudeDo dashboard:
   - For each port, try: `curl -s http://localhost:<port>/api/projects`
   - If it returns valid JSON (an array), the dashboard is already running on that port — skip to step 4 using that port.
3. If no existing dashboard found, start the dev server:
   - Check if port 3000 is free: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000` — if it returns `000` (no response), use 3000. Otherwise try 3001, 3002, etc. up to 3009.
   - Start on the chosen port: `cd <dashboard-path> && bun dev --port <port> &`
   - Wait a few seconds for the server to start, then verify with a curl to `/api/projects`.
   - If `bun` is not available, fall back to `npm run dev -- --port <port> &`.
4. Open the dashboard in the default browser:
   - macOS: `open http://localhost:<port>`
   - Linux: `xdg-open http://localhost:<port>`
5. Confirm to the user that the dashboard is running and which port it's on.

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
/todo                       Show status overview (same as /todo status)
/todo add [desc]            Add a new TODO item with enforced documentation
/todo done [item]           Mark an item as completed and archive it
/todo done step [text]      Mark a step as complete on the active task
/todo move [item] [status]  Move an item to any status directly
/todo start [item]          Start working on a specific task (with briefing)
/todo next                  Pick the highest-priority Ready item to work on
/todo stuck [item]          Mark an item as blocked with a reason
/todo status                Overview of all items by status
/todo scan                  Find inline // TODO comments and sync with TODO.md
/todo dashboard             Launch the web dashboard in the browser
/todo init                  Initialize TODO system (or migrate existing TODO.md)
/todo update                Refresh TODORULES.md template and audit items
/todo help                  Show this reference

Updating the skill:
  After pulling updates from the todo skill repo, run ./install.sh
  to sync the latest version to ~/.claude/skills/todo/
```

## Activity Logging

After every action that modifies TODO.md or DONE.md (`add`, `done`, `move`, `start`, `stuck`), log an event to the project's `.todo-activity.json` file. This powers the dashboard's activity feed.

**Event format:**
```json
{
  "date": "2026-02-12T14:30:00.000Z",
  "action": "STARTED",
  "title": "Fix login bug",
  "detail": "Queued → Active",
  "color": "text-blue-400"
}
```

**Action types and colors:**
- `ADDED` / `text-green-400` — new item added via `add`
- `STARTED` / `text-blue-400` — item moved to Active via `start` or `move`
- `COMPLETED` / `text-green-400` — item marked resolved via `done` or `move`
- `MOVED` / `text-yellow-400` — item moved between other statuses via `move` (e.g. Queued → Pending)
- `BLOCKED` / `text-red-400` — item marked blocked via `stuck` or `move`
- `UPDATED` / `text-purple-400` — step completed during work via `start` or `done step`

**Detail field:** Show the status transition, e.g. `"Queued → Active"`, `"Active → Resolved"`, `"Added to Queued"`.

**How to log:**
1. Read the existing `.todo-activity.json` from the project root. If it doesn't exist or is invalid, start with an empty array `[]`.
2. Create the new event object with the current ISO timestamp (`new Date().toISOString()` format).
3. Prepend the new event to the front of the array (newest first).
4. Trim the array to a maximum of 50 events.
5. Write the array back to `.todo-activity.json` with `JSON.stringify(events, null, 2)`.

**Important:** Log the event in a single write alongside the TODO.md/DONE.md changes. This ensures the activity feed reflects the actual action taken, not intermediate states.

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
