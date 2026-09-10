export type Priority = "Critical" | "High" | "Medium" | "Low"

export type Status = "Active" | "Blocked" | "Queued" | "Pending" | "Resolved"

export interface Step {
  title: string
  completed: boolean
}

export interface TodoItem {
  /** Stable id assigned by team sync; written to markdown as `<!-- id: ... -->`. */
  id?: string
  title: string
  priority: Priority
  category: string[]
  branch?: string
  /** Display name of whoever created the task (team sync). */
  author?: string
  description?: string
  files?: string[]
  context?: string
  acceptance?: string
  code?: string
  dependencies?: string
  steps?: Step[]
  added?: string
  started?: string
  completed?: string
  resolution?: string
  blocked?: string
  changelog?: string
  released?: string
  status: Status
}

export interface TodoSection {
  status: Status
  items: TodoItem[]
}

export type PetKey =
  | "cat" | "dog" | "frog" | "octopus" | "owl" | "snail" | "robot" | "dragon"
  | "penguin" | "ghost" | "crab" | "bat"

export type Presence = "working" | "away" | "idle"

export interface TeamMember {
  userId: string
  name: string
  pet: PetKey | null
  /** True when this member has any Active task across the team. */
  working: boolean
  /** working = active task and seen recently; away = active task but quiet; idle = no active task. */
  presence: Presence
  /** Last heartbeat from a sync or an open dashboard, ISO string. */
  lastSeen: string | null
}

export interface TeamPresence {
  members: TeamMember[]
  /** Task id -> user id of whoever moved it into Active. */
  activeBy: Record<string, string>
}

export interface ParsedProject {
  name: string
  path: string
  /** Normalized git remote (e.g. github.com/org/repo). Absent when not a git repo or no origin. */
  remote?: string
  /** True when this project is kept in step with the team database. */
  synced?: boolean
  /** Set when the last sync attempt failed; the files shown may be stale. */
  syncError?: string
  /** Team members and who is working on which task (team sync only). */
  team?: TeamPresence
  sections: TodoSection[]
  activity?: ActivityEvent[]
}

export type ActivityAgent = "claude" | "codex" | "dashboard"

export interface ActivityEvent {
  date: string
  action: string
  title: string
  detail: string
  color: string
  /** Who performed the action (git user.name); written by the skill and dashboard. */
  actor?: string
  /** Which host performed the action. */
  agent?: ActivityAgent
}

export interface ProjectConfig {
  name: string
  path: string
}

/** Optional team sync. Present = dashboard mirrors activity and task snapshots to Supabase. */
export interface SyncConfig {
  url: string
  publishableKey: string
}

export interface AppConfig {
  projects: ProjectConfig[]
  /** Named teams, each one Supabase project. */
  teams?: Record<string, SyncConfig>
  /** Legacy single-team form; read as a team named "default". */
  sync?: SyncConfig
}
