import { loadSyncConfig } from "../projects"
import { getAuthedClient, readStoredSession, type AuthedClient } from "./session"
import { syncProject, type SyncOptions, type SyncResult } from "./index"

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
}

let cachedAuth: { auth: AuthedClient; expires: number } | null = null
const AUTH_TTL_MS = 60_000

/** Authenticated client, cached briefly so polling doesn't re-validate the session every 3s. */
export async function getServerAuth(): Promise<AuthedClient | null> {
  if (cachedAuth && cachedAuth.expires > Date.now()) return cachedAuth.auth
  const config = await loadSyncConfig()
  const auth = await getAuthedClient(config)
  cachedAuth = auth ? { auth, expires: Date.now() + AUTH_TTL_MS } : null
  return auth
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const config = await loadSyncConfig()
  if (!config) return { configured: false, signedIn: false, displayName: null, userId: null, pet: null }
  const stored = await readStoredSession()
  if (!stored) return { configured: true, signedIn: false, displayName: null, userId: null, pet: null }
  const auth = await getServerAuth()
  if (!auth) return { configured: true, signedIn: false, displayName: stored.user.name ?? null, userId: null, pet: null }
  const { data } = await auth.client.from("profiles").select("pet").eq("id", auth.user.id).maybeSingle()
  return { configured: true, signedIn: true, displayName: auth.displayName, userId: auth.user.id, pet: (data?.pet as string | null) ?? null }
}

const inFlight = new Map<string, Promise<SyncResult>>()

/**
 * Sync one project directory, coalescing concurrent calls for the same path
 * (the poll and a write can overlap). Returns null when sync is off.
 */
export async function syncPath(path: string, opts: SyncOptions = {}): Promise<SyncResult | null> {
  const auth = await getServerAuth()
  if (!auth) return null
  const existing = inFlight.get(path)
  if (existing) return existing
  const run = syncProject(auth, path, opts).finally(() => inFlight.delete(path))
  inFlight.set(path, run)
  return run
}
