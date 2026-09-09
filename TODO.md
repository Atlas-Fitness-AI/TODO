# TODO

> Project: TODO

---

## Active

---

## Queued

---

## Blocked

---

## Pending

### Start task in active Claude Code session from dashboard
- **Priority**: Medium
- **Category**: Dashboard, Skill
- **Description**: Allow the dashboard to trigger a `/todo start [task]` in a running Claude Code session, so clicking "Start" on a card actually begins work — not just moves the status. Likely approach: dashboard writes a signal file (e.g. `.todo-start-signal.json`), a Claude Code hook detects it and initiates the start command. Needs research into whether hooks can inject prompts into an active session or only run shell commands.
- **Acceptance**: Clicking a "Start in Claude Code" action on a dashboard card causes an active Claude Code session to begin working on that task with the full `/todo start` briefing.
- **Added**: 2026-02-13

---

## Resolved
