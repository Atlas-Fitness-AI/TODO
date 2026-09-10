# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TODO is two things in one repo:
1. **Shared `todo` skill** — a structured TODO system for Claude Code (`/todo`) and Codex (`$todo`), defined in `SKILL.md` and installed to `~/.claude/skills/todo/` and `~/.agents/skills/todo/`
2. **Web dashboard** — a Next.js app in `dashboard/` that visualizes tasks across all projects

## Skill Sync

After editing `SKILL.md`, `install.sh`, or any file in `templates/`, run `./install.sh` to sync both agents' installations. Do this automatically within the host's filesystem permissions; use its approval mechanism when required.

## Commands

### Dashboard
```bash
cd dashboard && bun dev          # Start dev server at localhost:3000
cd dashboard && bun run build    # Production build (also serves as type check)
cd dashboard && bun run lint     # ESLint
```

### Skill
```bash
./install.sh                     # Sync skill + templates for both agents
bash tests/install.sh            # Check staged installs, updates, and migration
```

## Architecture

### Skill (`SKILL.md` + `templates/`)

The skill is a prompt-based instruction set, not executable code. `SKILL.md` defines commands (`add`, `done`, `move`, `start`, `next`, `stuck`, `status`, `scan`, `changelog`, `release`, `dashboard`, `init`, `update`, `help`) that either agent follows. The installer copies the same workflow to both hosts, stripping only Claude-specific frontmatter from the Codex copy. Templates resolve relative to the installed skill. `init` and `update` use `templates/AGENT-TODO.md` to maintain a TODO System section in both project instruction files, preserving other guidance.

### Dashboard (`dashboard/`)

Next.js 16 App Router with server components. Uses `@base-ui/react` (not Radix) as the headless UI layer via shadcn "base-lyra" style.

**Data flow:**
- `app/page.tsx` — server component reads cookies + calls `loadAllProjects()` from disk, passes as props
- `components/dashboard.tsx` — client component, wraps data in `useProjectPolling()` for auto-refresh every 3s
- `lib/parser.ts` — regex-based parser converts TODO.md/DONE.md markdown into typed `TodoSection[]`/`TodoItem[]`. Handles multi-line `Steps` field (checklist of sub-tasks). Includes `STATUS_ALIASES` mapping old names (In Progress, Ready, Stuck, Backlog, Done) to new canonical names for backwards compatibility with projects that haven't migrated yet.
- `lib/projects.ts` — reads `~/.atlas-todo/config.json` for project paths, loads and parses each project's TODO.md + DONE.md

**API routes:**
- `app/api/projects/route.ts` — GET (list projects + activity), PUT (validate path), POST (add), PATCH (rename), DELETE (remove). All operate on `~/.atlas-todo/config.json`.
- `app/api/tasks/route.ts` — POST (add task with optional steps), PATCH (move status, change priority, toggle step, or move to a branch via `newBranch`; null/empty = main), DELETE (delete task, clear status group, or clear activity log). Reads/writes TODO.md via parser + serializer, logs events to `.todo-activity.json`.
- `app/api/open/route.ts` — POST to open a project path in Finder or Terminal (validates path is a registered project)
- `app/api/release/route.ts` — POST to cut a release: gathers resolved items with a `Changelog` field and no `Released` field (branch-scoped), prepends a version section to the project's CHANGELOG.md, and stamps every in-scope resolved item with `Released: <version>` (TODO.md via serializer, DONE.md via targeted field upsert in `lib/changelog.ts`)

**Team sync (optional, `lib/use-team-sync.ts`):** when `~/.atlas-todo/config.json` has a `sync` block (`url`, `publishableKey`), `app/page.tsx` passes it to the Dashboard and the client mirrors state to Supabase. Push-only: projects are keyed by normalized git remote (`lib/git-remote.ts`), the hook upserts a `task_snapshots` row per project/branch with open items and inserts `activity_events` idempotently, and subscribes to Realtime on both tables. Auth is GitHub OAuth via supabase-js in the browser; no server-side session. The schema lives in `supabase/migrations/`. `components/team-menu.tsx` is the header control, `components/team-feed.tsx` the team panel behind the feed's local/team toggle. Activity events carry `actor` and `agent` (`claude` | `codex` | `dashboard`); the API routes stamp `agent: "dashboard"`.

**Key patterns:**
- Cookie-based state persistence (sidebar, selected project, tab, theme) — read on server, passed as `default*` props, written on client via `document.cookie`
- `useProjectPolling` hook polls GET `/api/projects` every 3s with hash-based change detection, skips when tab is hidden
- All shadcn components use base-ui primitives — `DropdownMenuTrigger` requires a `render` prop (`render={<button />}`), `DropdownMenuLabel` must be inside `DropdownMenuGroup`
- Tailwind CSS v4 — `@custom-variant dark (&:is(.dark *))` for dark mode, class-based via next-themes
- Sci-fi aesthetic: monospace font (Geist Mono), no border-radius, uppercase tracking, CardSpotlight with R3F particle effects
- Keyboard shortcuts via `useEffect` keydown listener in Dashboard: 1-5 (tabs), j/k (card nav), n (add task), / (search), ? (help), Esc (clear focus). Guarded against firing in inputs/textareas/dialogs.
- Help modal has four tabs (Overview, Skill, Dashboard, Keys) with fixed height and ScrollArea per tab

### Config & Storage

- **Project registry**: `~/.atlas-todo/config.json` — `{ projects: [{ name, path }], sync?: { url, publishableKey } }`
- **Dashboard path**: `~/.atlas-todo/dashboard-path` — used by `/todo dashboard` to locate the dev server
- **Skill install locations**: `~/.claude/skills/todo/` (Claude Code), `~/.agents/skills/todo/` (Codex)
- **Task data**: each project's `TODO.md` + `DONE.md` (markdown, parsed on read, no database)
- **Activity log**: each project's `.todo-activity.json` — event log written by the `/todo` skill on every action, read by the dashboard for the activity feed (newest-first, max 50 events)

## TODO System

This project uses a shared TODO system. Read `TODORULES.md` for the project's rules and `TODO.md` for current tasks when managing work. Completed items live in the configured archive (default `DONE.md`).

Use the `todo` skill: `/todo` in Claude Code or `$todo` in Codex. Both use the same commands:

- `status` — show current tasks (also the default with no command)
- `add [description]` — document a bug, feature, or task
- `start [item]` / `next` — start a specific task or select the next one
- `done step [text]` — complete a step on the active task
- `done [item]` — resolve and archive a task
- `move [item] [status]` / `stuck [item]` — change status or record a blocker
- `scan` — sync inline TODO/FIXME comments
- `changelog` / `release [version]` — preview or write release notes
- `dashboard` — launch the shared dashboard
- `init` / `update` — initialize the system or refresh its templates and guidance

For example: `/todo start Fix login timeout` in Claude Code or `$todo start Fix login timeout` in Codex.

When the user mentions tasks, bugs, features, or work items, suggest tracking them with this system so nothing gets lost. When asked to track work, use this system and preserve its fields, steps, branch scope, and archive configuration. Update `.todo-activity.json` as specified by the skill so either agent's progress appears in the dashboard. Re-read task files before editing when continuing another session's work.

**Changelog system:** resolved items may carry `- **Changelog**: <consumer-facing sentence>` (written by the skill on `done`, or from the dashboard's Release Notes dialog on the Resolved tab) and `- **Released**: <version>` (stamped when a release is cut). Pending release notes = changelog set, no release stamp. The dialog and the skill's `changelog` / `release` commands group entries into New/Fixed (bug-ish category or "Fix…" title → Fixed).
