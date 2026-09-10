import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import type { AppConfig, ParsedProject, ProjectConfig, SyncConfig } from "./types"
import { parseTodoMarkdown, parseDoneMarkdown } from "./parser"
import { getProjectRemote } from "./git-remote"

const CONFIG_PATH = join(homedir(), ".atlas-todo", "config.json")

export async function loadConfig(): Promise<AppConfig> {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return { projects: [] }
    }

    const raw = await readFile(CONFIG_PATH, "utf-8")
    const parsed = JSON.parse(raw)

    // Validate minimal structure
    if (!parsed || !Array.isArray(parsed.projects)) {
      return { projects: [] }
    }

    return parsed as AppConfig
  } catch {
    return { projects: [] }
  }
}

/** Team sync settings, or null when the dashboard runs local-only. */
export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const config = await loadConfig()
  const sync = config.sync
  if (!sync || typeof sync.url !== "string" || typeof sync.publishableKey !== "string") {
    return null
  }
  if (!sync.url.trim() || !sync.publishableKey.trim()) return null
  return { url: sync.url.trim().replace(/\/+$/, ""), publishableKey: sync.publishableKey.trim() }
}

export async function loadProject(
  config: ProjectConfig
): Promise<ParsedProject | null> {
  try {
    const todoPath = join(config.path, "TODO.md")

    if (!existsSync(todoPath)) {
      return null
    }

    const content = await readFile(todoPath, "utf-8")
    const parsed = parseTodoMarkdown(content)

    // Also try to load DONE.md for archived items
    try {
      const donePath = join(config.path, "DONE.md")
      if (existsSync(donePath)) {
        const doneContent = await readFile(donePath, "utf-8")
        const archivedItems = parseDoneMarkdown(doneContent)

        const doneSection = parsed.sections.find((s) => s.status === "Resolved")
        if (doneSection) {
          doneSection.items.push(...archivedItems)
        }
      }
    } catch {
      // DONE.md parse failure shouldn't prevent loading the project
    }

    const remote = await getProjectRemote(config.path)

    return {
      name: config.name || parsed.projectName,
      path: config.path,
      ...(remote && { remote }),
      sections: parsed.sections,
    }
  } catch {
    // Return null so one broken project doesn't kill the rest
    return null
  }
}

async function loadLocalProjects(configs: ProjectConfig[]): Promise<ParsedProject[]> {
  const projects: ParsedProject[] = []
  for (const projectConfig of configs) {
    const project = await loadProject(projectConfig)
    if (project) projects.push(project)
  }
  return projects
}

/**
 * All projects to show. Local-only: the registered paths that have a
 * TODO.md. Team sync: every team project (materialized to the registered
 * checkout when there is one, else to a cache directory), synced first, plus
 * registered paths that have no git remote.
 */
export async function loadAllProjects(): Promise<ParsedProject[]> {
  const config = await loadConfig()

  // Lazy import keeps the local-only path free of any sync dependencies.
  const { getServerAuth, syncPath } = await import("./sync/server")
  const auth = await getServerAuth()
  if (!auth) return loadLocalProjects(config.projects)

  const { listTeamProjects, cachePathForRemote, isSyncDisabled } = await import("./sync")
  let team: { id: number; remote_url: string; name: string }[]
  try {
    team = await listTeamProjects(auth.client)
  } catch {
    return loadLocalProjects(config.projects)
  }

  const localByRemote = new Map<string, ProjectConfig>()
  const unsynced: ProjectConfig[] = []
  const optedOut = new Set<string>()
  for (const pc of config.projects) {
    const remote = await getProjectRemote(pc.path)
    if (!remote || (await isSyncDisabled(pc.path))) {
      unsynced.push(pc)
      if (remote) optedOut.add(remote)
    } else {
      localByRemote.set(remote, pc)
    }
  }
  // A local checkout that opted out shadows the team's copy of that project.
  team = team.filter((t) => !optedOut.has(t.remote_url))
  // Local checkouts the team hasn't registered yet get registered by syncing.
  const remotes = new Set(team.map((t) => t.remote_url))
  for (const [remote, pc] of localByRemote) {
    if (!remotes.has(remote)) team.push({ id: -1, remote_url: remote, name: pc.name })
  }

  const synced = await Promise.all(
    team.map(async (t): Promise<ParsedProject | null> => {
      const local = localByRemote.get(t.remote_url)
      const path = local?.path ?? cachePathForRemote(t.remote_url)
      let syncError: string | undefined
      try {
        await syncPath(path, { remote: t.remote_url, assumeShared: !local })
      } catch (err) {
        syncError = (err as Error).message
      }
      const project = await loadProject({ name: local?.name ?? t.name, path })
      if (!project) return null
      return { ...project, remote: t.remote_url, synced: true, ...(syncError && { syncError }) }
    })
  )

  const local = await loadLocalProjects(unsynced)
  return [...synced.filter((p): p is ParsedProject => p !== null), ...local]
}
