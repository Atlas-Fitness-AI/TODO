# ClaudeDo

A structured TODO skill for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that turns Claude into a project task manager. Instead of messy checklists or scattered notes, every task gets documented with enforced standards — priority, category, file references, context, and acceptance criteria.

## Why

Claude is great at writing code but has no memory between sessions. Tasks get lost, context disappears, and you end up re-explaining what needs to happen. ClaudeDo gives every project a structured `TODO.md` that Claude reads automatically, so it always knows what's in progress, what's blocked, and what to work on next.

- Tasks are documented well enough that any session can pick them up
- Bugs require file references and root cause context
- Features require acceptance criteria
- Inline `// TODO` comments get synced with the tracker

## Install

```bash
git clone https://github.com/RouxCater/ClaudeDo.git
cd ClaudeDo
./install.sh
```

This copies the skill to `~/.claude/skills/todo/` where Claude Code picks it up globally.

## Setup in a Project

Open Claude Code in any project and run:

```
/todo init
```

This creates three things in your project:
- **`TODO.md`** — your task tracker
- **`TODORULES.md`** — rules and categories (customize this for your project)
- **`CLAUDE.md` section** — so new Claude sessions know the system exists

If you already have a `TODO.md`, init will migrate it — parsing your existing items into the structured format.

## Commands

```
/todo                       Status overview
/todo add [desc]            Add a new item (bug, feature, or task)
/todo done [item]           Mark as completed and archive
/todo move [item] [status]  Move an item to any status directly
/todo start [item]          Start a task with a full briefing
/todo next                  Pick the highest-priority ready item
/todo stuck [item]          Mark as blocked with a reason
/todo status                Full overview by status
/todo scan                  Find inline TODO/FIXME comments and sync them
/todo dashboard             Launch the web dashboard in the browser
/todo init                  Initialize or migrate TODO system
/todo update                Pull latest templates and audit existing items
/todo help                  Quick reference
```

## How It Works

### Item Structure

Every item gets a structured format based on its type:

```markdown
### Fix authentication timeout on refresh
- **Priority**: High
- **Category**: Backend, Auth
- **Files**: `src/auth/session.ts:42`, `src/middleware/refresh.ts:18`
- **Description**: Session refresh silently fails after 30 minutes, logging users out.
- **Context**: The refresh token check compares expiry against server time but the token uses UTC while the server uses local time.
- **Added**: 2026-02-12
```

Bugs require file references and context. Features require acceptance criteria. Tasks require a description of what and why.

### Status Flow

```
Backlog --> Ready --> In Progress --> Done
                 |         |
                 +- Stuck <+
                 |
                 +--> Ready (when unblocked)
```

- **Backlog** — identified but not fully defined
- **Ready** — all required fields present, can be picked up
- **In Progress** — actively being worked on
- **Stuck** — blocked, must have a reason
- **Done** — completed and archived

### Archiving

Completed items move to `DONE.md` by default, keeping `TODO.md` clean. This is configurable in `TODORULES.md`.

### Code Sync

`/todo scan` searches your codebase for `// TODO:`, `# TODO:`, `<!-- TODO: -->`, and `// FIXME:` comments. Untracked ones get offered for addition. Stale ones get flagged.

## Updating

After pulling new versions of ClaudeDo:

```bash
./install.sh
```

Then in each project that uses the skill:

```
/todo update
```

This refreshes `TODORULES.md` with the latest template (preserving your customizations) and audits existing items for compatibility.

## Dashboard

ClaudeDo includes a web dashboard for visualizing tasks across all your projects.

The quickest way to launch it is from Claude Code:

```
/todo dashboard
```

This starts the dev server (if not already running), finds a free port, and opens your browser. You can also start it manually:

```bash
cd dashboard
bun install
bun dev
```

The dashboard reads `TODO.md` files directly from disk — no server or database required.

**Features:**
- Add projects by path — validates the directory and auto-detects the project name from `TODO.md`
- Switch between status tabs (Active, Blocked, Ready, Backlog, Done)
- Activity feed — shows task movements (added, started, completed, blocked) with timestamps, powered by `/todo` skill actions
- Search and filter tasks by priority, category, or keyword
- Light/Dark/System theme toggle with cookie-based persistence
- Auto-refresh — dashboard updates within seconds when `TODO.md` changes externally
- Right-click projects to rename, remove, copy path, open in Finder, or open in Terminal
- UI state persists across page reloads (selected project, active tab, sidebar, theme)
- Sci-fi aesthetic with spotlight card effects

Projects are stored in `~/.claudedo/config.json`. You can add them via the "+" button in the sidebar or edit the file directly.

## Customization

Edit `TODORULES.md` in your project to:
- Add project-specific categories (e.g. `Auth`, `Billing`, `Mobile`)
- Toggle archiving on/off
- Change the archive file name
