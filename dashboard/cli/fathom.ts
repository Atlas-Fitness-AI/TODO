#!/usr/bin/env bun
/*
 * fathom — team sync for the Fathom todo skill.
 *
 *   fathom login [team]        sign in with GitHub for a team (one time per machine)
 *   fathom logout [team]       forget that team's stored session
 *   fathom whoami              show who is signed in, per team
 *   fathom sync [path]         push local edits, then regenerate the task files
 *   fathom sync --pull [path]  regenerate only, ignoring local edits
 *   fathom sync --force [path] allow a push that deletes many tasks
 *   fathom sync --all          sync every registered project
 *
 * With one team configured, [team] is optional everywhere. Exits 0 with a
 * short message when sync is not configured, so the skill can call it
 * unconditionally.
 */

import { resolve, basename } from "path"
import { createInterface } from "readline"
import { loadConfig } from "../lib/projects"
import { getAuthedClient, login, clearSession, readStoredSession, type AuthedClient } from "../lib/sync/session"
import {
  syncProject,
  getSyncSetting,
  setSyncSetting,
  hasSyncState,
  SyncError,
  SyncDisabledError,
  SyncUndecidedError,
  SyncUnknownTeamError,
  type SyncResult,
} from "../lib/sync"
import { loadTeams, resolveTeamName, type Teams } from "../lib/sync/teams"

const args = process.argv.slice(2)
const command = args[0] ?? "help"
const flags = new Set(args.filter((a) => a.startsWith("--")))
const positional = args.slice(1).filter((a) => !a.startsWith("--"))

function out(msg: string) {
  process.stdout.write(msg + "\n")
}

function fail(msg: string, code = 1): never {
  process.stderr.write(msg + "\n")
  process.exit(code)
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => rl.question(question, (answer) => { rl.close(); res(answer.trim()) }))
}

function summarize(r: SyncResult): string {
  const parts: string[] = []
  if (r.inserted) parts.push(`${r.inserted} created`)
  if (r.updated) parts.push(`${r.updated} updated`)
  if (r.deleted) parts.push(`${r.deleted} deleted`)
  const pushed = parts.length ? `pushed ${parts.join(", ")}` : "nothing to push"
  const pulled = r.filesChanged ? "files refreshed" : "files current"
  return `${r.projectName}: ${pushed}; ${pulled}`
}

/** Pick a team from the argument, or the only one, or ask. */
async function pickTeam(teams: Teams, given: string | undefined, purpose: string): Promise<string> {
  const names = Object.keys(teams)
  if (given) {
    if (!teams[given]) fail(`Unknown team "${given}". Configured: ${names.join(", ")}`)
    return given
  }
  if (names.length === 1) return names[0]
  if (!process.stdin.isTTY) fail(`Several teams are configured (${names.join(", ")}); say which: todo ${purpose} <team>`)
  const answer = await ask(`Which team? [${names.join("/")}] `)
  if (!teams[answer]) fail(`Unknown team "${answer}".`)
  return answer
}

/** Authenticated client for a team, with the pre-teams session honored for the first team. */
async function authFor(teams: Teams, team: string): Promise<AuthedClient | null> {
  return getAuthedClient(teams[team], team, Object.keys(teams)[0] === team)
}

/**
 * First sync of a project: decide which team it is shared with, or keep it
 * local. Returns the team name, or null when kept local.
 */
async function decideSharing(path: string, teams: Teams): Promise<string | null> {
  if (!process.stdin.isTTY) return null
  const names = Object.keys(teams)
  const prompt =
    names.length === 1
      ? `Share "${basename(path)}" with team "${names[0]}"? Tasks will live in the shared database. [y/N] `
      : `Share "${basename(path)}" with a team? Type one of [${names.join("/")}] or press enter to keep it local: `
  const answer = await ask(prompt)
  let team: string | null = null
  if (names.length === 1) team = /^y(es)?$/i.test(answer) ? names[0] : null
  else team = teams[answer] ? answer : null
  await setSyncSetting(path, team ?? false)
  out(team ? `Marked as shared with "${team}" (sync: ${team} in TODORULES.md).` : "Kept local (sync: false in TODORULES.md).")
  return team
}

/** Which team a project syncs with, from TODORULES.md. */
async function teamForProject(path: string, teams: Teams): Promise<{ team: string } | { undecided: true } | { disabled: true }> {
  const setting = await getSyncSetting(path)
  if (setting === false) return { disabled: true }
  if (setting === undefined) {
    if (await hasSyncState(path)) return { team: Object.keys(teams)[0] }
    return { undecided: true }
  }
  const name = resolveTeamName(setting, teams)
  if (!name) throw new SyncUnknownTeamError(String(setting))
  return { team: name }
}

async function main() {
  const teams = await loadTeams()
  const configured = Object.keys(teams).length > 0

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      out(
        [
          "usage: fathom <command>",
          "",
          "  login [team]          sign in with GitHub",
          "  logout [team]         forget the stored session",
          "  whoami                show who is signed in",
          "  sync [path]           push local edits, then regenerate TODO.md / DONE.md",
          "    --pull              regenerate only, ignore local edits",
          "    --force             allow a push that deletes many tasks",
          "    --all               sync every project in ~/.fathom/config.json",
          "",
          "Teams are configured under `teams` in ~/.fathom/config.json; each is one Supabase project.",
        ].join("\n")
      )
      return

    case "login": {
      if (!configured) fail("Team sync is not configured. Add a `teams` block to ~/.fathom/config.json first.")
      const team = await pickTeam(teams, positional[0], "login")
      const session = await login(teams[team], team, out)
      out(`Signed in to "${team}" as ${session.user.name ?? session.user.email ?? session.user.id}`)
      return
    }

    case "logout": {
      if (!configured) fail("Team sync is not configured.")
      const team = await pickTeam(teams, positional[0], "logout")
      await clearSession(team)
      out(`Signed out of "${team}".`)
      return
    }

    case "whoami": {
      if (!configured) {
        out("Team sync not configured (local-only).")
        return
      }
      for (const team of Object.keys(teams)) {
        const stored = await readStoredSession(team, Object.keys(teams)[0] === team)
        if (!stored) {
          out(`${team}: not signed in. Run: fathom login ${team}`)
          continue
        }
        const auth = await authFor(teams, team)
        out(auth ? `${team}: ${auth.displayName} (${auth.user.email ?? auth.user.id})` : `${team}: session expired. Run: fathom login ${team}`)
      }
      return
    }

    case "sync": {
      if (!configured) {
        out("Team sync not configured; using local files.")
        return
      }

      const targets: string[] = []
      if (flags.has("--all")) {
        const cfg = await loadConfig()
        targets.push(...cfg.projects.map((p) => p.path))
      } else {
        targets.push(resolve(positional[0] ?? process.cwd()))
      }

      let failed = false
      for (const path of targets) {
        const options = { force: flags.has("--force"), pullOnly: flags.has("--pull"), log: out }
        try {
          let which = await teamForProject(path, teams)
          if ("disabled" in which) {
            out(`${path}: ${new SyncDisabledError().message}`)
            continue
          }
          if ("undecided" in which) {
            const chosen = await decideSharing(path, teams)
            if (!chosen) {
              out(`${path}: ${process.stdin.isTTY ? "kept local" : new SyncUndecidedError().message}`)
              continue
            }
            which = { team: chosen }
          }
          const auth = await authFor(teams, which.team)
          if (!auth) {
            failed = true
            process.stderr.write(`${path}: not signed in to team "${which.team}". Run: fathom login ${which.team}\n`)
            continue
          }
          const result = await syncProject(auth, path, { ...options, team: which.team })
          out(summarize(result))
        } catch (err) {
          failed = true
          process.stderr.write(`${path}: ${(err as Error).message}\n`)
        }
      }
      if (failed) process.exit(1)
      return
    }

    default:
      fail(`Unknown command: ${command}. Run: fathom help`)
  }
}

main().catch((err) => {
  if (err instanceof SyncError) fail(err.message)
  fail(err?.message ?? String(err))
})
