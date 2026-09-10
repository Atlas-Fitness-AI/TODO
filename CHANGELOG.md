# Changelog

## Unreleased

### New
- The project is now called Fathom, with an anglerfish mascot. The `/todo` command is unchanged. Configuration moved to `~/.fathom` (migrated automatically), and the CLI is `fathom`, with `todo` kept as an alias.
- Screenshots in the README.
- Resolved cards credit the pet that finished them.
- Multiple teams, each its own Supabase project, with a switcher in the dashboard.
- Presence: working, away, and idle, from a heartbeat.
- Four more pets, and a reworked activity feed.

## v0.3.0 — 2026-09-10

### New
- Works in Codex as well as Claude Code. One skill, one installer, `$todo` or `/todo`.
- Team sync: tasks can live in a shared Supabase database so everyone sees the same board in real time, from either agent or the dashboard. Task files become local caches kept in step by a `todo` command.
- Every task records who created it, shown as an Author line and on cards.
- Pets: pick a pixel companion and it works alongside you on the tasks you start, stays on the ones you finish, and shows in a sidebar crew roster that tells working from away from idle.
- Two themes: Abyss (deep ocean) and Mono (zinc). Every theme now has its own status and accent colors.
- Collapsible task cards, with a header toggle and the `c` key.
- Projects are only shared when you say so; the first sync asks.
- Several teams: each is its own Supabase project, a project names the team it belongs to, and the dashboard switches between them.

### Fixed
- The installer test no longer depends on ripgrep.
- Task files checked out from an old branch can no longer overwrite the team's tasks.

## v0.2.0 — 2026-02-13
- Renamed ClaudeDo to TODO; configuration moved to `~/.atlas-todo`.

## v0.1.1 — 2026-02-13
- Dashboard favicon.

## v0.1.0 — 2026-02-13
- Initial release: the `/todo` skill and the dashboard.
