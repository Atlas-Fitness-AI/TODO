# TODO Rules

Rules and configuration for this project's TODO system. Claude Code and Codex read this file when managing TODO.md via the `todo` skill (`/todo` in Claude Code, `$todo` in Codex).

---

## Item Structure

### Required Fields (every item)

| Field           | Format                                           | Example                                          |
| :-------------- | :----------------------------------------------- | :----------------------------------------------- |
| **Title**       | Imperative mood, concise                         | `### Fix context menu freeze on table rows`      |
| **Priority**    | `Critical` \| `High` \| `Medium` \| `Low`       | `- **Priority**: High`                           |
| **Category**    | One or more from Categories list below           | `- **Category**: UI, Backend`                    |
| **Description** | 1-3 sentences, actionable (what needs to happen) | `- **Description**: Extract table into ...`      |

### Conditional Fields (required based on item type)

| Field            | Required When   | Purpose                                |
| :--------------- | :-------------- | :------------------------------------- |
| **Files**        | Bugs, code changes | File paths with line numbers: `` `path/to/file.tsx:42` `` |
| **Context**      | Bugs            | Root cause or background explanation   |
| **Acceptance**   | Features        | How to verify the feature is complete  |
| **Code**         | Complex bugs    | Relevant code snippet showing the issue |

### Optional Fields

| Field            | Purpose                                    |
| :--------------- | :----------------------------------------- |
| **Branch**       | Git branch this item is scoped to (e.g. a release branch like `training-beta`). Absent = mainline work ("main" in the dashboard). Only scope items that target a non-default branch. |
| **Author**       | Who created the item. Set automatically by team sync; read-only. |
| **Dependencies** | Comma-separated titles of other TODO items this depends on. The skill checks these before starting work. |
| **Steps**        | Checklist of sub-tasks or milestones. Each step is `- [ ] title` (pending) or `- [x] title` (done). The skill tracks progress and suggests resolving the parent when all steps complete. |
| **Started**      | Date work began (auto-set on Active)          |
| **Completed**    | Date finished (auto-set on Resolved)          |
| **Resolution**   | What was done to resolve (auto-set on Resolved)|
| **Changelog**    | One consumer-facing sentence describing the change for release notes (set on resolve for user-visible work). Plain language, no jargon or file names. |
| **Released**     | Version this item shipped in (auto-set by the skill's `release` command or the dashboard's Cut Release). Absent = not yet released. |
| **Blocked**      | Reason for being blocked (required on Blocked) |
| **Added**        | Date item was created                          |

---

## Statuses

Items flow through these statuses. Each section in TODO.md corresponds to one status.

| Status          | Meaning                                              |
| :-------------- | :--------------------------------------------------- |
| **Pending**     | Identified but not fully defined. Missing info needed before work can start. |
| **Queued**      | Well-defined with all required fields. Can be picked up immediately. |
| **Active**      | Actively being worked on. Should have a **Started** date. |
| **Blocked**     | Blocked or needs input. Must have a **Blocked** reason. |
| **Resolved**    | Completed and verified. Has **Completed** date and **Resolution**. |

### Transitions

```
Pending ──→ Queued ──→ Active ──→ Resolved
                   ↕        ↕
                Blocked ←────┘
                   │
                   └──→ Queued (when unblocked)
```

---

## Categories

Use one or more of these tags. Add project-specific categories below the defaults.

### Default Categories

| Category        | When to use                                        |
| :-------------- | :------------------------------------------------- |
| `UI`            | Visual components, layout, styling                 |
| `UX`            | User flows, interactions, accessibility            |
| `Backend`       | Server logic, API routes, data processing          |
| `Database`      | Schema, queries, migrations, Supabase              |
| `DevOps`        | CI/CD, deployment, infrastructure                  |
| `Testing`       | Tests, test infrastructure, coverage               |
| `Docs`          | Documentation, comments, READMEs                   |
| `Performance`   | Speed, optimization, caching                       |

### Project-Specific Categories

<!-- Add your own categories here -->
<!-- Example: `Auth`, `Billing`, `Analytics`, `Mobile` -->

---

## Conventions

1. **File references must be real paths.** Verify files exist before adding. Use relative paths from project root with line numbers: `` `src/components/Button.tsx:42` ``.

2. **One item per task.** If a task has multiple steps, use the **Steps** field to track them as a checklist. Break into separate items only if the steps are independently trackable work.

3. **Keep descriptions actionable.** Say what needs to happen, not just what's wrong. Details go in Context/Code fields.

4. **Sync with inline comments.** When adding a bug found via `// TODO:` in code, reference the comment. When completing, remove the inline comment.

5. **Titles use imperative mood.** "Fix", "Add", "Refactor", "Update" - not "Fixing", "Added", "Broken".

6. **Priority is relative to the project.** Critical = blocks other work or affects users. High = important, do soon. Medium = should do. Low = nice to have.

---

## Config

<!-- Machine-readable configuration for the /todo skill -->

```yaml
archive: true
archive_file: DONE.md
# Set to false to keep this project out of team sync (local files only).
sync: true
```
