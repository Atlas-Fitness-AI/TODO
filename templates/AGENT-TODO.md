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

When the user mentions tasks, bugs, features, or work items, suggest tracking them with this system so nothing gets lost. If `~/.fathom/bin/fathom` exists, run `fathom sync` there before reading task files and after editing them; the skill describes this. When asked to track work, use this system and preserve its fields, steps, branch scope, and archive configuration. Update `.todo-activity.json` as specified by the skill so either agent's progress appears in the dashboard. Re-read task files before editing when continuing another session's work.
