# TODO

A structured TODO skill for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [Codex](https://developers.openai.com/codex/skills/) that gives either agent a shared project task manager. Every task gets documented with enforced standards — priority, category, file references, context, and acceptance criteria.

## Why

When you switch sessions or coding agents, task context can get lost. TODO gives every project a structured `TODO.md` and project instructions so Claude Code and Codex can pick up what's in progress, what's blocked, and what to work on next.

- Tasks are documented well enough that any session can pick them up
- Bugs require file references and root cause context
- Features require acceptance criteria
- Inline `// TODO` comments get synced with the tracker

## Install

```bash
git clone https://github.com/Atlas-Fitness-AI/TODO.git
cd TODO
./install.sh
```

This installs the shared skill and templates globally for both agents:

- Claude Code: `~/.claude/skills/todo/`
- Codex: `~/.agents/skills/todo/`

To install for just one agent, use `./install.sh --claude` or `./install.sh --codex`. You can run the installer from any directory. For a staged installation, `--prefix DIR` uses that directory in place of your home directory, including for `.atlas-todo` configuration.

The workflow comes from one `SKILL.md`. The Codex installation omits only Claude-specific frontmatter (`argument-hint` and `allowed-tools`). If a newly installed skill doesn't appear, restart the agent.

## Setup in a Project

Open either agent in your project and run:

```text
Claude Code: /todo init
Codex:       $todo init
```

This sets up:
- **`TODO.md`** — your task tracker
- **`TODORULES.md`** — rules and categories (customize this for your project)
- **`CLAUDE.md` and `AGENTS.md` sections** — so both agents know the system exists

If you have an unstructured `TODO.md`, init migrates it. If the project already uses this system, init preserves the tasks and rules and adds or updates the agent guidance.

### Existing Claude Code Projects

After running the updated installer, use `$todo init` in Codex to add the missing guidance to an existing TODO project. Use `$todo update` if you also want to refresh the rules and audit tasks. Both commands preserve unrelated content in `CLAUDE.md` and `AGENTS.md`.

You can add a task with Claude Code, start it with Codex, and complete it with either agent. Both use the same `TODO.md`, `TODORULES.md`, archive, and activity log, and the existing dashboard shows both agents' changes. For a direct handoff, open the same project checkout; separate git worktrees have separate task files.

## Commands

The examples below use Claude Code's `/todo` prefix. In Codex use `$todo` with the same command and details, for example `$todo add Fix login timeout` or `$todo start Fix login timeout`. You can also select the skill with `/skills` in Codex CLI or the IDE extension.

```
/todo                       Status overview
/todo add [desc]            Add a new item (bug, feature, or task)
/todo done [item]           Mark as completed and archive
/todo done step [text]      Mark a step as complete on the active task
/todo move [item] [status]  Move an item to any status directly
/todo start [item]          Start a task with a full briefing (auto-completes steps)
/todo next                  Pick the highest-priority queued item
/todo stuck [item]          Mark as blocked with a reason
/todo status                Full overview by status
/todo scan                  Find inline TODO/FIXME comments and sync them
/todo changelog             Preview pending release notes
/todo release [version]     Write release notes and stamp resolved items
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
- **Dependencies**: Migrate session store to Redis
- **Steps**:
  - [x] Fix timezone comparison
  - [ ] Add refresh token rotation
  - [ ] Write integration tests
- **Added**: 2026-02-12
```

Bugs require file references and context. Features require acceptance criteria. Tasks require a description of what and why. Any item can optionally declare dependencies on other tasks — the skill checks these before starting work and warns about unresolved ones.

### Steps

Tasks can have sub-tasks tracked as a checklist. The skill auto-generates steps for complex tasks during `/todo add` and auto-completes them as it works during `/todo start` — updating TODO.md and the activity feed as each step finishes. When all steps are done, the skill suggests resolving the parent task. You can also manually mark steps with `/todo done step [text]`.

### Status Flow

```
Pending --> Queued --> Active --> Resolved
                 |        |
                 +- Blocked <+
                 |
                 +--> Queued (when unblocked)
```

- **Pending** — identified but not fully defined
- **Queued** — all required fields present, can be picked up
- **Active** — actively being worked on
- **Blocked** — blocked, must have a reason
- **Resolved** — completed and archived

### Archiving

Completed items move to `DONE.md` by default, keeping `TODO.md` clean. This is configurable in `TODORULES.md`.

### Code Sync

`/todo scan` searches your codebase for `// TODO:`, `# TODO:`, `<!-- TODO: -->`, and `// FIXME:` comments. Untracked ones get offered for addition. Stale ones get flagged.

## Updating

After pulling new versions of TODO:

```bash
./install.sh
```

Then in each project that uses the skill:

```text
Claude Code: /todo update
Codex:       $todo update
```

This refreshes `TODORULES.md` with the latest template (preserving your customizations), audits existing items for compatibility, and updates both agents' project guidance.

## Dashboard

TODO includes a web dashboard for visualizing tasks across all your projects.

The quickest way to launch it is from either agent:

```text
Claude Code: /todo dashboard
Codex:       $todo dashboard
```

This starts the dev server (if not already running), finds a free port, and opens your browser. You can also start it manually:

```bash
cd dashboard
bun install
bun dev
```

The dashboard's local Next.js server reads `TODO.md` files directly from disk — no database or agent-specific integration required.

**Features:**
- Add projects by path — validates the directory and auto-detects the project name from `TODO.md`
- Switch between status tabs (Active, Blocked, Queued, Pending, Resolved)
- Activity feed — shows task movements (added, started, completed, blocked) with timestamps, powered by `/todo` skill actions
- Add new tasks directly from the dashboard with priority, status, category, description, dependencies, and steps
- Task steps render as a progress bar with expandable mini cards — click to toggle completion
- Clear all tasks in a status group with the "—" button next to "+"
- Move tasks between statuses and change priority via right-click context menu on cards
- Search and filter tasks by priority, category, or keyword
- Light/Dark/System theme toggle with cookie-based persistence
- Auto-refresh — dashboard updates within seconds when `TODO.md` changes externally
- Right-click projects to rename, remove, copy path, open in Finder, or open in Terminal
- Keyboard shortcuts — `1-5` switch tabs, `j/k` navigate cards, `n` add task, `/` search, `?` help
- Help modal with Overview, Skill, Dashboard, and Keys reference tabs
- UI state persists across page reloads (selected project, active tab, sidebar, theme)
- Backwards compatible with old status names (In Progress, Ready, Stuck, Backlog, Done)
- Sci-fi aesthetic with spotlight card effects

Projects are stored in `~/.atlas-todo/config.json`. You can add them via the "+" button in the sidebar or edit the file directly.

## Customization

Edit `TODORULES.md` in your project to:
- Add project-specific categories (e.g. `Auth`, `Billing`, `Mobile`)
- Toggle archiving on/off
- Change the archive file name
