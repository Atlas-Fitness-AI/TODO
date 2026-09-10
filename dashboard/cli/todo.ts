#!/usr/bin/env bun
/*
 * todo — team sync for the TODO skill.
 *
 *   todo login              sign in with GitHub (one time per machine)
 *   todo logout             forget the stored session
 *   todo whoami             show the signed-in user
 *   todo sync [path]        push local edits, then regenerate the task files
 *   todo sync --pull [path] regenerate only, ignoring local edits
 *   todo sync --force [path] allow a push that deletes many tasks
 *   todo sync --all         sync every registered project
 *
 * Exits 0 with a short message when sync is not configured, so the skill can
 * call it unconditionally.
 */

import { resolve, basename } from "path"
import { createInterface } from "readline"
import { loadConfig, loadSyncConfig } from "../lib/projects"
import { getAuthedClient, login, clearSession, readStoredSession } from "../lib/sync/session"
import { syncProject, setSyncSetting, SyncError, SyncDisabledError, SyncUndecidedError, type SyncResult } from "../lib/sync"

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

/** First sync of a project: decide whether it is shared. Returns false when the user keeps it local. */
async function decideSharing(path: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false
  const answer = await ask(`Share "${basename(path)}" with your team? Tasks will live in the shared database. [y/N] `)
  const share = /^y(es)?$/i.test(answer)
  await setSyncSetting(path, share)
  out(share ? "Marked as shared (sync: true in TODORULES.md)." : "Kept local (sync: false in TODORULES.md).")
  return share
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

async function main() {
  const config = await loadSyncConfig()

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      out(
        [
          "usage: todo <command>",
          "",
          "  login                 sign in with GitHub",
          "  logout                forget the stored session",
          "  whoami                show the signed-in user",
          "  sync [path]           push local edits, then regenerate TODO.md / DONE.md",
          "    --pull              regenerate only, ignore local edits",
          "    --force             allow a push that deletes many tasks",
          "    --all               sync every project in ~/.atlas-todo/config.json",
          "",
          "Sync is configured by a `sync` block in ~/.atlas-todo/config.json.",
        ].join("\n")
      )
      return

    case "login": {
      if (!config) fail("Team sync is not configured. Add a `sync` block to ~/.atlas-todo/config.json first.")
      const session = await login(config, out)
      out(`Signed in as ${session.user.name ?? session.user.email ?? session.user.id}`)
      return
    }

    case "logout":
      await clearSession()
      out("Signed out.")
      return

    case "whoami": {
      if (!config) {
        out("Team sync not configured (local-only).")
        return
      }
      const stored = await readStoredSession()
      if (!stored) {
        out("Not signed in. Run: todo login")
        return
      }
      const auth = await getAuthedClient(config)
      if (!auth) {
        out(`Session for ${stored.user.name ?? stored.user.id} has expired. Run: todo login`)
        return
      }
      out(`Signed in as ${auth.displayName} (${auth.user.email ?? auth.user.id})`)
      return
    }

    case "sync": {
      if (!config) {
        out("Team sync not configured; using local files.")
        return
      }
      const auth = await getAuthedClient(config)
      if (!auth) fail("Not signed in to team sync. Run: todo login", 2)

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
          let result: SyncResult
          try {
            result = await syncProject(auth, path, options)
          } catch (err) {
            if (!(err instanceof SyncUndecidedError)) throw err
            if (!(await decideSharing(path))) {
              out(`${path}: ${process.stdin.isTTY ? "kept local" : err.message}`)
              continue
            }
            result = await syncProject(auth, path, options)
          }
          out(summarize(result))
        } catch (err) {
          if (err instanceof SyncDisabledError) {
            out(`${path}: ${err.message}`)
            continue
          }
          failed = true
          process.stderr.write(`${path}: ${(err as Error).message}\n`)
        }
      }
      if (failed) process.exit(1)
      return
    }

    default:
      fail(`Unknown command: ${command}. Run: todo help`)
  }
}

main().catch((err) => {
  if (err instanceof SyncError) fail(err.message)
  fail(err?.message ?? String(err))
})
