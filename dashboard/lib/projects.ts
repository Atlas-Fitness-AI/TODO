import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import type { AppConfig, ParsedProject, ProjectConfig, SyncConfig, TeamMember, TeamPresence, PetKey, Presence } from "./types"

/** Seen within this window counts as present. */
const AWAY_AFTER_MS = 5 * 60_000
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

/** First team's sync settings, or null when the dashboard runs local-only. Prefer loadTeams(). */
export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const { loadTeams } = await import("./sync/teams")
  const teams = await loadTeams()
  const first = Object.keys(teams)[0]
  return first ? teams[first] : null
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
 * All projects to show for one team. Local-only: the registered paths that
 * have a TODO.md. Team sync: every project of the selected team (materialized
 * to the registered checkout when there is one, else to a cache directory),
 * synced first, plus registered paths that are local (no remote, opted out,
 * undecided, or shared with a different team).
 */
export async function loadAllProjects(team: string | null = null): Promise<ParsedProject[]> {
  const config = await loadConfig()

  // Lazy import keeps the local-only path free of any sync dependencies.
  const { getServerAuth, syncPath, defaultTeam } = await import("./sync/server")
  const selected = team ?? (await defaultTeam())
  const auth = await getServerAuth(selected)
  if (!auth || !selected) return loadLocalProjects(config.projects)

  const { listTeamProjects, cachePathForRemote, getSyncSetting, hasSyncState } = await import("./sync")
  const { loadTeams, resolveTeamName } = await import("./sync/teams")
  const teams = await loadTeams()
  let teamRows: { id: number; remote_url: string; name: string }[]
  try {
    teamRows = await listTeamProjects(auth.client)
  } catch {
    return loadLocalProjects(config.projects)
  }

  const localByRemote = new Map<string, ProjectConfig>()
  const unsynced: ProjectConfig[] = []
  const shadowed = new Set<string>()
  for (const pc of config.projects) {
    const remote = await getProjectRemote(pc.path)
    if (!remote) {
      unsynced.push(pc)
      continue
    }
    const setting = await getSyncSetting(pc.path)
    const target = setting === false || setting === undefined ? null : resolveTeamName(setting, teams)
    const undecided = setting === undefined && !(await hasSyncState(pc.path))
    if (target === selected && !undecided) {
      localByRemote.set(remote, pc)
    } else if (setting === undefined && !undecided) {
      // Synced before teams existed: belongs to the first team.
      if (Object.keys(teams)[0] === selected) localByRemote.set(remote, pc)
      else unsynced.push(pc)
    } else {
      unsynced.push(pc)
      if (setting === false || undecided) shadowed.add(remote)
    }
  }
  // A local checkout that opted out (or hasn't decided) shadows the team's copy.
  teamRows = teamRows.filter((t) => !shadowed.has(t.remote_url))
  // Local checkouts the team hasn't registered yet get registered by syncing.
  const remotes = new Set(teamRows.map((t) => t.remote_url))
  for (const [remote, pc] of localByRemote) {
    if (!remotes.has(remote)) teamRows.push({ id: -1, remote_url: remote, name: pc.name })
  }

  // Presence: every member (with pet) and who is on which Active task.
  let presenceByProject = new Map<number, TeamPresence>()
  try {
    const [{ data: profiles }, { data: active }] = await Promise.all([
      auth.client.from("profiles").select("id, display_name, pet, last_seen"),
      auth.client.from("tasks").select("id, project_id, active_by").eq("status", "Active").eq("archived", false).not("active_by", "is", null),
    ])
    const workingIds = new Set((active ?? []).map((t) => t.active_by as string))
    const now = Date.now()
    const members: TeamMember[] = (profiles ?? []).map((p) => {
      const working = workingIds.has(p.id as string)
      const lastSeen = (p.last_seen as string | null) ?? null
      const seenRecently = lastSeen !== null && now - Date.parse(lastSeen) < AWAY_AFTER_MS
      const presence: Presence = !working ? "idle" : seenRecently ? "working" : "away"
      return {
        userId: p.id as string,
        name: (p.display_name as string | null) ?? "teammate",
        pet: (p.pet as PetKey | null) ?? null,
        working,
        presence,
        lastSeen,
      }
    })
    presenceByProject = new Map()
    for (const t of teamRows) presenceByProject.set(t.id, { members, activeBy: {} })
    for (const row of active ?? []) {
      const entry = presenceByProject.get(row.project_id as number)
      if (entry) entry.activeBy[row.id as string] = row.active_by as string
    }
  } catch {
    // Presence is decoration; never block the board on it.
  }

  const synced = await Promise.all(
    teamRows.map(async (t): Promise<ParsedProject | null> => {
      const local = localByRemote.get(t.remote_url)
      const path = local?.path ?? cachePathForRemote(`${selected}/${t.remote_url}`)
      let syncError: string | undefined
      try {
        await syncPath(selected, path, { remote: t.remote_url, assumeShared: !local, team: selected })
      } catch (err) {
        syncError = (err as Error).message
      }
      const project = await loadProject({ name: local?.name ?? t.name, path })
      if (!project) return null
      const presence = presenceByProject.get(t.id)
      return { ...project, remote: t.remote_url, synced: true, team: presence, ...(syncError && { syncError }) }
    })
  )

  const local = await loadLocalProjects(unsynced)
  return [...synced.filter((p): p is ParsedProject => p !== null), ...local]
}
