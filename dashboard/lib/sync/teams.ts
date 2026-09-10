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
