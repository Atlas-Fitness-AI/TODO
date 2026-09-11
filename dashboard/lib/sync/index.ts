import { readFile, writeFile, mkdir, rename } from "fs/promises"
import { existsSync } from "fs"
import { createHash, randomBytes } from "crypto"
import { execFile } from "child_process"
import { promisify } from "util"
import { basename, join } from "path"
import { homedir } from "os"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ActivityEvent, Status, TodoItem, TodoSection } from "../types"
import { parseTodoMarkdown, parseDoneMarkdown, serializeTodoMarkdown, serializeDoneMarkdown } from "../parser"
import { getProjectRemote } from "../git-remote"
import type { AuthedClient } from "./session"

/*
 * Push-then-pull sync between a project's markdown files and the tasks
 * table. Files are a cache: `.todo-sync.json` remembers what was last
 * materialized, so a differing file hash means "local edits to push".
 */

const execFileAsync = promisify(execFile)

const STATE_FILE = ".todo-sync.json"
const ACTIVITY_FILE = ".todo-activity.json"
const ACTIVITY_LIMIT = 50
const SECTION_ORDER: Status[] = ["Active", "Queued", "Blocked", "Pending", "Resolved"]
const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const LEGACY_AGENT = "dashboard"
/** Refuse to delete this many tasks in one push unless forced; guards against a truncated file. */
const DELETE_GUARD_MIN = 5
const DELETE_GUARD_RATIO = 0.3

interface SyncState {
  projectId: number
  todoHash: string
  doneHash: string
  syncedAt: string
}

export interface TaskRow {
  id: string
  project_id: number
  branch: string | null
  status: Status
  priority: TodoItem["priority"]
  title: string
  category: string[]
  description: string | null
  files: string[] | null
  context: string | null
  acceptance: string | null
  code: string | null
  dependencies: string | null
  steps: { title: string; completed: boolean }[]
  added: string | null
  started: string | null
  completed: string | null
  resolution: string | null
  blocked: string | null
  changelog: string | null
  released: string | null
  archived: boolean
  position: number
  created_by: string
  updated_by: string
  /** Who moved the task into Active; null once it leaves. */
  active_by: string | null
  /** Who moved the task into Resolved; kept so the finisher stays credited. */
  completed_by: string | null
  updated_at: string
  author?: { display_name: string | null } | null
}

export interface SyncResult {
  projectId: number
  projectName: string
  remote: string
  inserted: number
  updated: number
  deleted: number
  filesChanged: boolean
  eventsPushed: number
}

export class SyncError extends Error {}

/* ------------------------------------------------------------------ utils */

function hash(content: string): string {
  return createHash("sha1").update(content).digest("hex")
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8")
  } catch {
    return null
  }
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, content, "utf-8")
  await rename(tmp, path)
}

async function readState(projectPath: string): Promise<SyncState | null> {
  try {
    const raw = await readFile(join(projectPath, STATE_FILE), "utf-8")
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed.projectId === "number" ? (parsed as SyncState) : null
  } catch {
    return null
  }
}

async function writeState(projectPath: string, state: SyncState): Promise<void> {
  await writeAtomic(join(projectPath, STATE_FILE), JSON.stringify(state, null, 2) + "\n")
}

const RULES_FILE = "TODORULES.md"
const FENCE = "```"
const YAML_BLOCK = /```ya?ml\n([\s\S]*?)```/

/**
 * The project's team-sync decision from the config block of TODORULES.md:
 * a team name or true (share; true means the first configured team),
 * false (keep local), or undefined (nobody has decided yet).
 */
export async function getSyncSetting(projectPath: string): Promise<string | boolean | undefined> {
  const rules = await readIfExists(join(projectPath, RULES_FILE))
  if (!rules) return undefined
  const block = rules.match(YAML_BLOCK)
  const body = block ? block[1] : rules
  const match = body.match(/^\s*sync:\s*([A-Za-z0-9_-]+)\s*(#.*)?$/m)
  if (!match) return undefined
  const value = match[1]
  if (value === "true") return true
  if (value === "false") return false
  return value
}

/** Record the decision in TODORULES.md: a team name, true, or false. Creates a config block if needed. */
export async function setSyncSetting(projectPath: string, enabled: string | boolean): Promise<void> {
  const path = join(projectPath, RULES_FILE)
  const line = `sync: ${enabled}`
  let rules = (await readIfExists(path)) ?? "# TODO Rules\n"
  const block = rules.match(YAML_BLOCK)
  if (block) {
    const body = block[1]
    const next = /^\s*sync:\s*[A-Za-z0-9_-]+\s*(#.*)?$/m.test(body)
      ? body.replace(/^(\s*)sync:\s*[A-Za-z0-9_-]+\s*(#.*)?$/m, `$1${line}`)
      : body.replace(/\n?$/, "") + `\n${line}\n`
    rules = rules.replace(block[0], FENCE + "yaml\n" + next + FENCE)
  } else {
    rules =
      rules.replace(/\n?$/, "") +
      "\n\n## Config\n\n" +
      FENCE + "yaml\narchive: true\narchive_file: DONE.md\n" + line + "\n" + FENCE + "\n"
  }
  await writeAtomic(path, rules)
}

/** True once this checkout has synced at least once. */
export async function hasSyncState(projectPath: string): Promise<boolean> {
  return (await readState(projectPath)) !== null
}

export class SyncDisabledError extends SyncError {
  constructor() {
    super("Team sync disabled for this project (sync: false in TODORULES.md)")
  }
}

export class SyncUndecidedError extends SyncError {
  constructor() {
    super("This project hasn't been shared with a team yet. Set `sync: <team>` or `sync: false` in TODORULES.md, or run `fathom sync` in a terminal to choose.")
  }
}

export class SyncUnknownTeamError extends SyncError {
  constructor(team: string) {
    super(`TODORULES.md names team "${team}", which is not in ~/.fathom/config.json.`)
  }
}

/** Whether syncProject would run for this checkout. */
export async function isSyncDisabled(projectPath: string): Promise<boolean> {
  const setting = await getSyncSetting(projectPath)
  if (setting === false) return true
  if (setting === undefined) return !(await hasSyncState(projectPath))
  return false
}

export function newTaskId(): string {
  return randomBytes(6).toString("hex")
}

/** Where a team project without a local checkout gets materialized. */
export function cachePathForRemote(remote: string): string {
  return join(homedir(), ".fathom", "cache", remote.replace(/[^a-z0-9._-]+/gi, "_"))
}

/* --------------------------------------------------------- row <-> item */

function nullable(value: string | undefined): string | null {
  return value && value.trim() ? value : null
}

export function itemToRow(
  item: TodoItem,
  projectId: number,
  position: number,
  archived: boolean,
  userId: string,
  existing?: TaskRow
): Omit<TaskRow, "updated_at" | "author"> {
  return {
    id: item.id ?? existing?.id ?? newTaskId(),
    project_id: projectId,
    branch: nullable(item.branch),
    status: archived ? "Resolved" : item.status,
    priority: item.priority,
    title: item.title,
    category: item.category ?? [],
    description: nullable(item.description),
    files: item.files && item.files.length > 0 ? item.files : null,
    context: nullable(item.context),
    acceptance: nullable(item.acceptance),
    code: nullable(item.code),
    dependencies: nullable(item.dependencies),
    steps: item.steps ?? [],
    added: nullable(item.added),
    started: nullable(item.started),
    completed: nullable(item.completed),
    resolution: nullable(item.resolution),
    blocked: nullable(item.blocked),
    changelog: nullable(item.changelog),
    released: nullable(item.released),
    archived,
    position,
    created_by: existing?.created_by ?? userId,
    updated_by: userId,
    // The pet follows whoever started the work: set on the transition into
    // Active, kept while it stays there, cleared when it leaves.
    active_by:
      !archived && item.status === "Active"
        ? existing?.status === "Active" && !existing.archived
          ? existing.active_by
          : userId
        : null,
    completed_by:
      archived || item.status === "Resolved"
        ? existing?.status === "Resolved" || existing?.archived
          ? existing.completed_by ?? userId
          : userId
        : null,
  }
}

export function rowToItem(row: TaskRow): TodoItem {
  const author = row.author?.display_name ?? undefined
  return {
    id: row.id,
    title: row.title,
    priority: row.priority,
    category: row.category ?? [],
    status: row.status,
    ...(row.branch && { branch: row.branch }),
    ...(author && { author }),
    ...(row.description && { description: row.description }),
    ...(row.files && row.files.length > 0 && { files: row.files }),
    ...(row.context && { context: row.context }),
    ...(row.acceptance && { acceptance: row.acceptance }),
    ...(row.code && { code: row.code }),
    ...(row.dependencies && { dependencies: row.dependencies }),
    ...(row.steps && row.steps.length > 0 && { steps: row.steps }),
    ...(row.added && { added: row.added }),
    ...(row.started && { started: row.started }),
    ...(row.completed && { completed: row.completed }),
    ...(row.resolution && { resolution: row.resolution }),
    ...(row.blocked && { blocked: row.blocked }),
    ...(row.changelog && { changelog: row.changelog }),
    ...(row.released && { released: row.released }),
  }
}

/** Fields that count as "changed" between a file item and its DB row. */
const COMPARED_FIELDS = [
  "branch", "status", "priority", "title", "category", "description", "files", "context",
  "acceptance", "code", "dependencies", "steps", "added", "started", "completed", "resolution",
  "blocked", "changelog", "released", "archived", "position", "active_by", "completed_by",
] as const

function rowsDiffer(a: Omit<TaskRow, "updated_at" | "author">, b: TaskRow): boolean {
  for (const f of COMPARED_FIELDS) {
    if (JSON.stringify(a[f] ?? null) !== JSON.stringify(b[f] ?? null)) return true
  }
  return false
}

/* ------------------------------------------------------------- rendering */

const TASK_SELECT =
  "id, project_id, branch, status, priority, title, category, description, files, context, acceptance, code, dependencies, steps, added, started, completed, resolution, blocked, changelog, released, archived, position, created_by, updated_by, active_by, completed_by, updated_at, author:profiles!tasks_created_by_fkey(display_name)"

async function fetchTasks(client: SupabaseClient, projectId: number): Promise<TaskRow[]> {
  const { data, error } = await client.from("tasks").select(TASK_SELECT).eq("project_id", projectId)
  if (error) throw new SyncError(`Could not load tasks: ${error.message}`)
  return data as unknown as TaskRow[]
}

function sortRows(rows: TaskRow[]): TaskRow[] {
  return [...rows].sort((a, b) => {
    const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
    if (p !== 0) return p
    return a.position - b.position
  })
}

export function renderFiles(projectName: string, rows: TaskRow[]): { todo: string; done: string } {
  const sections: TodoSection[] = SECTION_ORDER.map((status) => ({
    status,
    items: sortRows(rows.filter((r) => !r.archived && r.status === status)).map(rowToItem),
  }))
  const archived = [...rows.filter((r) => r.archived)].sort((a, b) => a.position - b.position).map(rowToItem)
  return {
    todo: serializeTodoMarkdown(projectName, sections),
    done: serializeDoneMarkdown(archived),
  }
}

/* ---------------------------------------------------------------- project */

async function projectNameFrom(projectPath: string, todoContent: string | null): Promise<string> {
  const match = todoContent?.match(/^>\s*Project:\s*(.+)$/m)
  if (match && match[1].trim() && match[1].trim() !== "Unknown Project") return match[1].trim()
  return basename(projectPath)
}

async function ensureProject(
  client: SupabaseClient,
  userId: string,
  remote: string,
  name: string
): Promise<{ id: number; name: string }> {
  const { data: existing } = await client.from("projects").select("id, name").eq("remote_url", remote).maybeSingle()
  if (existing) return existing as { id: number; name: string }
  const { data: created, error } = await client
    .from("projects")
    .insert({ remote_url: remote, name, created_by: userId })
    .select("id, name")
    .single()
  if (error) {
    const { data: again } = await client.from("projects").select("id, name").eq("remote_url", remote).maybeSingle()
    if (again) return again as { id: number; name: string }
    throw new SyncError(`Could not register project: ${error.message}`)
  }
  return created as { id: number; name: string }
}

/* --------------------------------------------------------------- activity */

interface StoredEvent extends ActivityEvent {
  /** Set on events pulled from the team feed so they are never re-pushed. */
  remoteId?: number
}

async function readActivity(projectPath: string): Promise<StoredEvent[]> {
  try {
    const parsed = JSON.parse(await readFile(join(projectPath, ACTIVITY_FILE), "utf-8"))
    return Array.isArray(parsed) ? (parsed as StoredEvent[]) : []
  } catch {
    return []
  }
}

async function pushActivity(client: SupabaseClient, projectId: number, userId: string, events: StoredEvent[]): Promise<number> {
  const rows = events
    .filter((e) => e.remoteId === undefined && e.date && !Number.isNaN(Date.parse(e.date)))
    .map((e) => ({
      project_id: projectId,
      user_id: userId,
      agent: e.agent ?? LEGACY_AGENT,
      branch: null,
      action: e.action,
      title: e.title,
      detail: e.detail ?? null,
      color: e.color ?? null,
      occurred_at: new Date(e.date).toISOString(),
    }))
  if (rows.length === 0) return 0
  const { error } = await client
    .from("activity_events")
    .upsert(rows, { onConflict: "project_id,user_id,occurred_at,action,title", ignoreDuplicates: true })
  if (error) throw new SyncError(`Could not push activity: ${error.message}`)
  return rows.length
}

async function pullActivity(client: SupabaseClient, projectPath: string, projectId: number): Promise<boolean> {
  const { data, error } = await client
    .from("activity_events")
    .select("id, agent, action, title, detail, color, occurred_at, actor:profiles!activity_events_user_id_fkey(display_name)")
    .eq("project_id", projectId)
    .order("occurred_at", { ascending: false })
    .limit(ACTIVITY_LIMIT)
  if (error) throw new SyncError(`Could not load activity: ${error.message}`)
  const events: StoredEvent[] = (data as unknown as {
    id: number; agent: ActivityEvent["agent"]; action: string; title: string; detail: string | null; color: string | null; occurred_at: string; actor: { display_name: string | null } | null
  }[]).map((r) => ({
    date: r.occurred_at,
    action: r.action,
    title: r.title,
    detail: r.detail ?? "",
    color: r.color ?? "",
    ...(r.actor?.display_name && { actor: r.actor.display_name }),
    agent: r.agent,
    remoteId: r.id,
  }))
  const content = JSON.stringify(events, null, 2) + "\n"
  const current = await readIfExists(join(projectPath, ACTIVITY_FILE))
  if (current === content) return false
  await writeAtomic(join(projectPath, ACTIVITY_FILE), content)
  return true
}

/* ------------------------------------------------------------- gitignore */

const IGNORED = ["TODO.md", "DONE.md", ACTIVITY_FILE, STATE_FILE]

async function ensureGitignore(projectPath: string, log: (msg: string) => void): Promise<void> {
  if (!existsSync(join(projectPath, ".git"))) return
  const path = join(projectPath, ".gitignore")
  const current = (await readIfExists(path)) ?? ""
  const lines = current.split("\n").map((l) => l.trim())
  const missing = IGNORED.filter((entry) => !lines.includes(entry))
  if (missing.length === 0) return
  const next = current.endsWith("\n") || current === "" ? current : current + "\n"
  await writeFile(path, `${next}# TODO team sync: task files live in the database\n${missing.join("\n")}\n`, "utf-8")
  log(`Added ${missing.join(", ")} to .gitignore`)
  try {
    const { stdout } = await execFileAsync("git", ["-C", projectPath, "ls-files", "--", "TODO.md", "DONE.md"])
    const tracked = stdout.trim().split("\n").filter(Boolean)
    if (tracked.length > 0) {
      log(`Note: ${tracked.join(" and ")} still tracked by git. Run: git rm --cached ${tracked.join(" ")}`)
    }
  } catch {
    // not fatal
  }
}

/* ------------------------------------------------------------- presence */

const HEARTBEAT_MS = 60_000
let lastHeartbeat = 0

/**
 * Stamp profiles.last_seen for the current user, at most once a minute per
 * process. Also keeps display_name and avatar in step with GitHub: an invited
 * user's profile is created from their email before they ever sign in, so
 * the first heartbeat after sign-in is what gives them their real name.
 */
export async function touchPresence(client: SupabaseClient, userId: string, identity?: { displayName: string; avatarUrl?: string | null }): Promise<void> {
  if (Date.now() - lastHeartbeat < HEARTBEAT_MS) return
  lastHeartbeat = Date.now()
  await client
    .from("profiles")
    .update({
      last_seen: new Date().toISOString(),
      ...(identity && { display_name: identity.displayName, ...(identity.avatarUrl && { avatar_url: identity.avatarUrl }) }),
    })
    .eq("id", userId)
}

/* ------------------------------------------------------------------ sync */

export interface SyncOptions {
  /** Project identity when the directory is not a git checkout (cache dirs). */
  remote?: string
  /** Sync even when TODORULES.md has no explicit decision (team cache dirs). */
  assumeShared?: boolean
  /** The team the client belongs to; refuses a project that names a different one. */
  team?: string
  /** Allow a push that deletes many tasks at once. */
  force?: boolean
  /** Skip pushing even if the files changed (read-only refresh). */
  pullOnly?: boolean
  log?: (msg: string) => void
}

export async function syncProject(auth: AuthedClient, projectPath: string, opts: SyncOptions = {}): Promise<SyncResult> {
  const log = opts.log ?? (() => {})
  const { client, user } = auth

  const setting = await getSyncSetting(projectPath)
  if (setting === false) throw new SyncDisabledError()
  if (setting === undefined && !opts.assumeShared && !(await hasSyncState(projectPath))) {
    throw new SyncUndecidedError()
  }
  if (typeof setting === "string" && opts.team && setting !== opts.team) {
    throw new SyncError(`This project is shared with team "${setting}", not "${opts.team}".`)
  }

  const remote = opts.remote ?? (await getProjectRemote(projectPath))
  if (!remote) throw new SyncError(`${projectPath} has no git origin remote; team sync needs one to identify the project`)

  const todoPath = join(projectPath, "TODO.md")
  const donePath = join(projectPath, "DONE.md")
  const todoContent = await readIfExists(todoPath)
  const doneContent = await readIfExists(donePath)

  const project = await ensureProject(client, user.id, remote, await projectNameFrom(projectPath, todoContent))
  void touchPresence(client, user.id, { displayName: auth.displayName, avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null })
  const state = await readState(projectPath)
  let rows = await fetchTasks(client, project.id)

  const todoHash = hash(todoContent ?? "")
  const doneHash = hash(doneContent ?? "")
  const stateMatches = state !== null && state.projectId === project.id
  const localChanged =
    !opts.pullOnly &&
    (todoContent !== null || doneContent !== null) &&
    (!stateMatches || state.todoHash !== todoHash || state.doneHash !== doneHash)

  let inserted = 0
  let updated = 0
  let deleted = 0

  let staleWarning: string | undefined

  if (localChanged) {
    const parsed = todoContent ? parseTodoMarkdown(todoContent) : null
    const archivedItems = doneContent ? parseDoneMarkdown(doneContent) : []

    // Synced files always carry id comments. A file with items but no ids
    // while the team already has tasks is almost certainly a stale copy that
    // git checked out from a branch predating sync. Regenerate instead of
    // pushing it, unless forced.
    const fileItems = (parsed?.sections.flatMap((sec) => sec.items) ?? []).concat(archivedItems)
    const hasIds = fileItems.some((i) => i.id)
    if (!opts.force && rows.length > 0 && fileItems.length > 0 && !hasIds) {
      staleWarning =
        "Local task files have no sync ids and look like a stale copy (e.g. checked out from another git branch). " +
        "Regenerated them from the team database instead of pushing. Use --force to push the local copy."
    }
  }

  if (localChanged && !staleWarning) {
    const parsed = todoContent ? parseTodoMarkdown(todoContent) : null
    const archivedItems = doneContent ? parseDoneMarkdown(doneContent) : []
    const byId = new Map(rows.map((r) => [r.id, r]))
    const byTitle = new Map(rows.map((r) => [`${r.archived ? 1 : 0}|${r.title}`, r]))
    const seen = new Set<string>()
    const inserts: Omit<TaskRow, "updated_at" | "author">[] = []
    const updates: Omit<TaskRow, "updated_at" | "author">[] = []

    const consider = (item: TodoItem, position: number, archived: boolean) => {
      // Match by id first; fall back to title so a first-time import of
      // files that predate ids doesn't duplicate anything.
      const existing = (item.id && byId.get(item.id)) || (!item.id && byTitle.get(`${archived ? 1 : 0}|${item.title}`)) || undefined
      const row = itemToRow(item, project.id, position, archived, user.id, existing)
      if (seen.has(row.id)) return
      seen.add(row.id)
      if (!existing) inserts.push(row)
      else if (rowsDiffer(row, existing)) updates.push(row)
    }

    if (parsed) {
      for (const section of parsed.sections) {
        section.items.forEach((item, i) => consider(item, i, false))
      }
    }
    archivedItems.forEach((item, i) => consider(item, i, true))

    // Deletions only after this machine has synced before (so a fresh clone
    // or `/todo init` template never wipes the team's tasks), and only for
    // files that actually exist (a missing DONE.md must not wipe the archive).
    const toDelete = stateMatches
      ? rows.filter((r) => !seen.has(r.id) && (r.archived ? doneContent !== null : todoContent !== null))
      : []
    // A task file with zero items almost always means a template overwrite
    // or a truncated write, not an intentional wipe. Bulk deletions need
    // --force too.
    const openInFile = parsed ? parsed.sections.reduce((n, sec) => n + sec.items.length, 0) : 0
    const wipesOpen = todoContent !== null && openInFile === 0 && toDelete.some((r) => !r.archived)
    const wipesArchive = doneContent !== null && archivedItems.length === 0 && toDelete.some((r) => r.archived)
    const bulk = toDelete.length >= DELETE_GUARD_MIN && toDelete.length >= rows.length * DELETE_GUARD_RATIO
    if (!opts.force && (wipesOpen || wipesArchive || bulk)) {
      throw new SyncError(
        `Push would delete ${toDelete.length} of ${rows.length} tasks` +
          (wipesOpen || wipesArchive ? " because a task file is empty" : "") +
          `. If that's intended, run again with --force.`
      )
    }

    if (inserts.length > 0) {
      const { error } = await client.from("tasks").insert(inserts)
      if (error) throw new SyncError(`Could not create tasks: ${error.message}`)
      inserted = inserts.length
    }
    for (const row of updates) {
      const { id, ...fields } = row
      const { error } = await client.from("tasks").update(fields).eq("id", id)
      if (error) throw new SyncError(`Could not update "${row.title}": ${error.message}`)
      updated++
    }
    if (toDelete.length > 0) {
      const { error } = await client.from("tasks").delete().in("id", toDelete.map((r) => r.id))
      if (error) throw new SyncError(`Could not delete tasks: ${error.message}`)
      deleted = toDelete.length
    }

    if (inserted || updated || deleted) rows = await fetchTasks(client, project.id)
  }

  if (staleWarning) log(staleWarning)

  const eventsPushed = opts.pullOnly ? 0 : await pushActivity(client, project.id, user.id, await readActivity(projectPath))

  // Pull: regenerate the files from the database.
  const rendered = renderFiles(project.name, rows)
  await mkdir(projectPath, { recursive: true })
  let filesChanged = false
  if (rendered.todo !== todoContent) {
    await writeAtomic(todoPath, rendered.todo)
    filesChanged = true
  }
  if (rendered.done !== doneContent) {
    await writeAtomic(donePath, rendered.done)
    filesChanged = true
  }
  const activityChanged = await pullActivity(client, projectPath, project.id)
  await writeState(projectPath, {
    projectId: project.id,
    todoHash: hash(rendered.todo),
    doneHash: hash(rendered.done),
    syncedAt: new Date().toISOString(),
  })
  await ensureGitignore(projectPath, log)

  return {
    projectId: project.id,
    projectName: project.name,
    remote,
    inserted,
    updated,
    deleted,
    filesChanged: filesChanged || activityChanged,
    eventsPushed,
  }
}

/** All projects the team has registered, for materializing ones without a local checkout. */
export async function listTeamProjects(client: SupabaseClient): Promise<{ id: number; remote_url: string; name: string }[]> {
  const { data, error } = await client.from("projects").select("id, remote_url, name").order("name")
  if (error) throw new SyncError(`Could not list projects: ${error.message}`)
  return data as { id: number; remote_url: string; name: string }[]
}
