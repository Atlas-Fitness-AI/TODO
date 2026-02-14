# TODO

> Project: ClaudeDo

---

## Active

---

## Queued

---

## Blocked

---

## Pending

### Display task dependencies in dashboard cards
- **Priority**: Low
- **Category**: Dashboard, UI
- **Description**: The `dependencies` field is already parsed and available on `TodoItem` but completely ignored by the dashboard UI. Render dependencies on task cards as linked references (similar to how `files` renders as code chips). As a future enhancement, could show a "blocked by" indicator if the dependency task isn't in Resolved status yet.
- **Acceptance**: Task cards with a `dependencies` field display the dependency text visually, styled consistently with existing card fields like files and context.
- **Added**: 2026-02-13

### Start task in active Claude Code session from dashboard
- **Priority**: Medium
- **Category**: Dashboard, Skill
- **Description**: Allow the dashboard to trigger a `/todo start [task]` in a running Claude Code session, so clicking "Start" on a card actually begins work — not just moves the status. Likely approach: dashboard writes a signal file (e.g. `.todo-start-signal.json`), a Claude Code hook detects it and initiates the start command. Needs research into whether hooks can inject prompts into an active session or only run shell commands.
- **Acceptance**: Clicking a "Start in Claude Code" action on a dashboard card causes an active Claude Code session to begin working on that task with the full `/todo start` briefing.
- **Added**: 2026-02-13

---

## Resolved
