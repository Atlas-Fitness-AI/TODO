import { getAuthedClient, readStoredSession, type AuthedClient } from "./session"
import { syncProject, type SyncOptions, type SyncResult } from "./index"
import { loadTeams, LEGACY_TEAM, type Teams } from "./teams"

/*
 * Dashboard-server entry points for team sync. Everything here degrades to a
 * no-op when sync is not configured or nobody has run `todo login`.
 */

export interface SyncStatus {
  configured: boolean
  signedIn: boolean
  displayName: string | null
  userId: string | null
  pet: string | null
  /** The team this status describes, and every configured team name. */
  team: string | null
  teams: string[]
}

const cachedAuth = new Map<string, { auth: AuthedClient | null; expires: number }>()
const AUTH_TTL_MS = 60_000

/** Forget the cached auth for a team, e.g. right after a sign-in or sign-out. */
export function invalidateAuth(team?: string): void {
  if (team) cachedAuth.delete(team)
  else cachedAuth.clear()
}

export { loadTeams }

/** First configured team name, or null. */
export async function defaultTeam(): Promise<string | null> {
  const names = Object.keys(await loadTeams())
  return names[0] ?? null
}

/** Authenticated client for a team, cached briefly so polling doesn't re-validate every 3s. */
export async function getServerAuth(team: string | null): Promise<AuthedClient | null> {
  if (!team) return null
  const hit = cachedAuth.get(team)
  if (hit && hit.expires > Date.now()) return hit.auth
  const teams: Teams = await loadTeams()
  const config = teams[team] ?? null
  // The first team may still hold its session in the pre-teams file.
  const isFirst = Object.keys(teams)[0] === team || team === LEGACY_TEAM
  const auth = await getAuthedClient(config, team, isFirst)
  cachedAuth.set(team, { auth, expires: Date.now() + AUTH_TTL_MS })
  return auth
}

export async function getSyncStatus(team: string | null): Promise<SyncStatus> {
  const teams = Object.keys(await loadTeams())
  const off = { configured: false, signedIn: false, displayName: null, userId: null, pet: null, team: null, teams }
  if (teams.length === 0) return off
  const current = team && teams.includes(team) ? team : teams[0]
  const stored = await readStoredSession(current, teams[0] === current)
  if (!stored) return { ...off, configured: true, team: current }
  const auth = await getServerAuth(current)
  if (!auth) return { ...off, configured: true, displayName: stored.user.name ?? null, team: current }
  const { data } = await auth.client.from("profiles").select("pet").eq("id", auth.user.id).maybeSingle()
  return {
    configured: true,
    signedIn: true,
    displayName: auth.displayName,
    userId: auth.user.id,
    pet: (data?.pet as string | null) ?? null,
    team: current,
    teams,
  }
}

const inFlight = new Map<string, Promise<SyncResult>>()

/**
 * Sync one project directory against one team, coalescing concurrent calls
 * for the same path. Returns null when that team isn't signed in.
 */
export async function syncPath(team: string, path: string, opts: SyncOptions = {}): Promise<SyncResult | null> {
  const auth = await getServerAuth(team)
  if (!auth) return null
  const key = `${team}|${path}`
  const existing = inFlight.get(key)
  if (existing) return existing
  const run = syncProject(auth, path, opts).finally(() => inFlight.delete(key))
  inFlight.set(key, run)
  return run
}
