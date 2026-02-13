# TODO

> Project: ClaudeDo

---

## In Progress

<!-- Items actively being worked on. -->

---

## Ready

### Wire activity feed to real data
- **Priority**: High
- **Category**: Dashboard, Parser
- **Description**: Replace the hardcoded placeholder activity items with real data derived from TODO.md changes. Could parse git history of TODO.md, use file modification timestamps, or introduce a lightweight event log.
- **Acceptance**: Activity feed shows actual task movements (added, moved, completed) with real timestamps. Placeholder items are removed.
- **Added**: 2026-02-12

### Harden parser for malformed TODO.md files
- **Priority**: Medium
- **Category**: Parser
- **Description**: The parser assumes well-formed TODO.md with all sections present and correct field formatting. Add graceful handling for missing sections, extra whitespace, malformed field lines, and partially structured items so the dashboard doesn't break on imperfect files.
- **Acceptance**: Parser returns partial results instead of failing when TODO.md has missing sections, empty fields, or unexpected formatting.
- **Files**: `dashboard/lib/parser.ts`
- **Added**: 2026-02-12

### Add /todo dashboard command to launch the web UI
- **Priority**: Medium
- **Category**: Skill, Dashboard
- **Description**: Add a `/todo dashboard` command to the skill that starts the Next.js dev server from the dashboard directory and opens the browser. Should detect if the server is already running and just open the URL in that case.
- **Acceptance**: Running `/todo dashboard` in Claude Code starts the dashboard and opens `localhost:3000` in the default browser. If already running, it just opens the URL.
- **Files**: `SKILL.md`
- **Added**: 2026-02-12

### Add copy path, open in Finder, and open in Terminal to project context menu
- **Priority**: Low
- **Category**: Dashboard, UX
- **Description**: Extend the right-click context menu on sidebar projects with utility actions: copy the project path to clipboard, open in macOS Finder, and open in a new Terminal window.
- **Added**: 2026-02-12

---

## Stuck

<!-- Blocked items. Each must have a Blocked reason. -->

---

## Backlog

### Support task editing from the dashboard
- **Priority**: Medium
- **Category**: Dashboard, Backend
- **Description**: Allow moving tasks between statuses, editing priorities, and adding new items directly from the web UI instead of requiring Claude Code. Would need write-back API routes that modify TODO.md.
- **Added**: 2026-02-12

### Package dashboard as an npm/bun executable
- **Priority**: Low
- **Category**: DevOps, Dashboard
- **Description**: Set up the dashboard as a publishable package so users can run `bunx claudedo` or `npx claudedo` to start the dashboard without cloning the repo. Would need a bin entry, bundling config, and the config path logic to work standalone.
- **Added**: 2026-02-12
