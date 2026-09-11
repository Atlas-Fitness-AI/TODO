import { readFile, writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import type { SyncConfig } from "../types"

/*
 * Teams. Each team is one Supabase project. Config:
 *
 *   { "projects": [...], "teams": { "atlas": { "url": ..., "publishableKey": ... } } }
 *
 * A legacy top-level `sync` block is read as a team named "default".
 */

const CONFIG_DIR = join(homedir(), ".fathom")
const CONFIG_PATH = join(CONFIG_DIR, "config.json")

export const LEGACY_TEAM = "default"

export type Teams = Record<string, SyncConfig>

function validConfig(value: unknown): SyncConfig | null {
  if (!value || typeof value !== "object") return null
  const v = value as { url?: unknown; publishableKey?: unknown }
  if (typeof v.url !== "string" || typeof v.publishableKey !== "string") return null
  if (!v.url.trim() || !v.publishableKey.trim()) return null
  return { url: v.url.trim().replace(/\/+$/, ""), publishableKey: v.publishableKey.trim() }
}

/** All configured teams, in config order. Empty when sync is off. */
export async function loadTeams(): Promise<Teams> {
  try {
    if (!existsSync(CONFIG_PATH)) return {}
    const raw = JSON.parse(await readFile(CONFIG_PATH, "utf-8")) as { teams?: unknown; sync?: unknown }
    const teams: Teams = {}
    if (raw.teams && typeof raw.teams === "object") {
      for (const [name, value] of Object.entries(raw.teams as Record<string, unknown>)) {
        const cfg = validConfig(value)
        if (cfg && /^[a-z0-9][a-z0-9_-]*$/i.test(name)) teams[name] = cfg
      }
    }
    const legacy = validConfig(raw.sync)
    if (legacy && Object.keys(teams).length === 0) teams[LEGACY_TEAM] = legacy
    return teams
  } catch {
    return {}
  }
}

export async function teamNames(): Promise<string[]> {
  return Object.keys(await loadTeams())
}

/** The team a `sync:` value refers to: `true` means the first configured team. */
export function resolveTeamName(setting: string | true, teams: Teams): string | null {
  const names = Object.keys(teams)
  if (names.length === 0) return null
  if (setting === true) return names[0]
  return teams[setting] ? setting : null
}

/** Rewrite a legacy `sync` block into `teams: { [name]: ... }`. Idempotent. */
export async function migrateLegacyConfig(name: string): Promise<boolean> {
  if (!existsSync(CONFIG_PATH)) return false
  const raw = JSON.parse(await readFile(CONFIG_PATH, "utf-8")) as Record<string, unknown>
  const legacy = validConfig(raw.sync)
  if (!legacy) return false
  const teams = (raw.teams && typeof raw.teams === "object" ? raw.teams : {}) as Record<string, unknown>
  if (!teams[name]) teams[name] = legacy
  delete raw.sync
  raw.teams = teams
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify(raw, null, 2) + "\n", "utf-8")
  return true
}

export const TEAM_NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/i

async function readRawConfig(): Promise<Record<string, unknown>> {
  if (!existsSync(CONFIG_PATH)) return { projects: [] }
  try {
    return JSON.parse(await readFile(CONFIG_PATH, "utf-8")) as Record<string, unknown>
  } catch {
    return { projects: [] }
  }
}

async function writeRawConfig(raw: Record<string, unknown>): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify(raw, null, 2) + "\n", "utf-8")
}

/** Add or replace a team. Throws on a bad name or config. */
export async function addTeam(name: string, config: SyncConfig): Promise<void> {
  if (!TEAM_NAME.test(name)) throw new Error("Team name: letters, digits, dashes, underscores; up to 32 characters")
  const valid = validConfig(config)
  if (!valid) throw new Error("A Supabase URL and publishable key are required")
  const raw = await readRawConfig()
  const teams = (raw.teams && typeof raw.teams === "object" ? raw.teams : {}) as Record<string, unknown>
  // Fold a legacy block in so it is not silently lost.
  const legacy = validConfig(raw.sync)
  if (legacy && Object.keys(teams).length === 0) teams[LEGACY_TEAM] = legacy
  delete raw.sync
  teams[name] = valid
  raw.teams = teams
  await writeRawConfig(raw)
}

export async function removeTeam(name: string): Promise<boolean> {
  const raw = await readRawConfig()
  const teams = (raw.teams && typeof raw.teams === "object" ? raw.teams : {}) as Record<string, unknown>
  if (!(name in teams)) return false
  delete teams[name]
  raw.teams = teams
  await writeRawConfig(raw)
  return true
}

/** Confirm the URL and key point at a reachable Supabase project. */
export async function probeTeam(config: SyncConfig): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${config.url}/auth/v1/health`, { headers: { apikey: config.publishableKey }, signal: AbortSignal.timeout(6000) })
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "The key was rejected by that project" }
    if (!res.ok) return { ok: false, reason: `Supabase answered ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: `Could not reach ${config.url}: ${(err as Error).message}` }
  }
}
