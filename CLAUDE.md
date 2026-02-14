# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClaudeDo is two things in one repo:
1. **`/todo` Claude Code skill** — a structured TODO system that Claude uses to manage tasks in any project (defined in `SKILL.md`, installed to `~/.claude/skills/todo/`)
2. **Web dashboard** — a Next.js app in `dashboard/` that visualizes tasks across all projects

## Skill Sync

After editing `SKILL.md` or any file in `templates/`, always run `./install.sh` to sync to `~/.claude/skills/todo/`. Do this automatically — don't wait for the user to ask.

## Commands

### Dashboard
```bash
cd dashboard && bun dev          # Start dev server at localhost:3000
cd dashboard && bun run build    # Production build (also serves as type check)
cd dashboard && bun run lint     # ESLint
```

### Skill
```bash
./install.sh                     # Sync skill + templates to ~/.claude/skills/todo/
```

## Architecture

### Skill (`SKILL.md` + `templates/`)

The skill is a prompt-based instruction set, not executable code. `SKILL.md` defines commands (`add`, `done`, `move`, `start`, `next`, `stuck`, `status`, `scan`, `init`, `update`, `help`) that Claude follows when users invoke `/todo`. Templates in `templates/` are copied to projects on `/todo init`.

### Dashboard (`dashboard/`)

Next.js 16 App Router with server components. Uses `@base-ui/react` (not Radix) as the headless UI layer via shadcn "base-lyra" style.

**Data flow:**
- `app/page.tsx` — server component reads cookies + calls `loadAllProjects()` from disk, passes as props
- `components/dashboard.tsx` — client component, wraps data in `useProjectPolling()` for auto-refresh every 3s
- `lib/parser.ts` — regex-based parser converts TODO.md/DONE.md markdown into typed `TodoSection[]`/`TodoItem[]`. Includes `STATUS_ALIASES` mapping old names (In Progress, Ready, Stuck, Backlog, Done) to new canonical names for backwards compatibility with projects that haven't migrated yet.
- `lib/projects.ts` — reads `~/.claudedo/config.json` for project paths, loads and parses each project's TODO.md + DONE.md

**API routes:**
- `app/api/projects/route.ts` — GET (list projects + activity), PUT (validate path), POST (add), PATCH (rename), DELETE (remove). All operate on `~/.claudedo/config.json`.
- `app/api/tasks/route.ts` — POST (add task), PATCH (move status or change priority), DELETE (clear activity log). Reads/writes TODO.md via parser + serializer, logs events to `.todo-activity.json`.
- `app/api/open/route.ts` — POST to open a project path in Finder or Terminal (validates path is a registered project)

**Key patterns:**
- Cookie-based state persistence (sidebar, selected project, tab, theme) — read on server, passed as `default*` props, written on client via `document.cookie`
- `useProjectPolling` hook polls GET `/api/projects` every 3s with hash-based change detection, skips when tab is hidden
- All shadcn components use base-ui primitives — `DropdownMenuTrigger` requires a `render` prop (`render={<button />}`), `DropdownMenuLabel` must be inside `DropdownMenuGroup`
- Tailwind CSS v4 — `@custom-variant dark (&:is(.dark *))` for dark mode, class-based via next-themes
- Sci-fi aesthetic: monospace font (Geist Mono), no border-radius, uppercase tracking, CardSpotlight with R3F particle effects
- Keyboard shortcuts via `useEffect` keydown listener in Dashboard: 1-5 (tabs), j/k (card nav), n (add task), / (search), ? (help), Esc (clear focus). Guarded against firing in inputs/textareas/dialogs.
- Help modal has four tabs (Overview, Skill, Dashboard, Keys) with fixed height and ScrollArea per tab

### Config & Storage

- **Project registry**: `~/.claudedo/config.json` — array of `{ name, path }` entries
- **Dashboard path**: `~/.claudedo/dashboard-path` — used by `/todo dashboard` to locate the dev server
- **Skill install location**: `~/.claude/skills/todo/`
- **Task data**: each project's `TODO.md` + `DONE.md` (markdown, parsed on read, no database)
- **Activity log**: each project's `.todo-activity.json` — event log written by the `/todo` skill on every action, read by the dashboard for the activity feed (newest-first, max 50 events)

## TODO System

This project uses a structured TODO system. Tasks, bugs, and features are tracked in `TODO.md` with rules defined in `TODORULES.md`.

Use the `/todo` skill to manage items:
- `/todo` or `/todo status` — overview of all items
- `/todo add [description]` — add a new item (bugs, features, tasks)
- `/todo done [item]` — mark an item as completed
- `/todo move [item] [status]` — move an item to any status directly
- `/todo start [item]` — start working on a specific task (with briefing)
- `/todo next` — pick the highest-priority item to work on
- `/todo stuck [item]` — mark an item as blocked
- `/todo scan` — find inline TODO comments in code and sync them
