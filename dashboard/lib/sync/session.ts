import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js"
import { readFile, writeFile, mkdir, unlink } from "fs/promises"
import { existsSync } from "fs"
import { createServer } from "http"
import { execFile } from "child_process"
import { join } from "path"
import { homedir } from "os"
import type { SyncConfig } from "../types"

/*
 * Server-side (CLI and Next.js API) Supabase session. The browser never
 * holds credentials; everything goes through ~/.atlas-todo/session.json,
 * which `todo login` writes and both the CLI and the dashboard server read.
 */

const CONFIG_DIR = join(homedir(), ".atlas-todo")
const SESSIONS_DIR = join(CONFIG_DIR, "sessions")
/** Pre-teams session file; read as the session for the first team when its own file is missing. */
const LEGACY_SESSION_PATH = join(CONFIG_DIR, "session.json")

function sessionPath(team: string): string {
  return join(SESSIONS_DIR, `${team}.json`)
}

export interface StoredSession {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: { id: string; email?: string; name?: string }
}

export interface AuthedClient {
  client: SupabaseClient
  user: User
  displayName: string
}

export function createServerClient(config: SyncConfig): SupabaseClient {
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "pkce" },
  })
}

export async function readStoredSession(team: string, legacyFallback = false): Promise<StoredSession | null> {
  try {
    let path = sessionPath(team)
    if (!existsSync(path) && legacyFallback && existsSync(LEGACY_SESSION_PATH)) path = LEGACY_SESSION_PATH
    if (!existsSync(path)) return null
    const parsed = JSON.parse(await readFile(path, "utf-8"))
    if (!parsed?.access_token || !parsed?.refresh_token || !parsed?.user?.id) return null
    return parsed as StoredSession
  } catch {
    return null
  }
}

function displayNameOf(user: User): string {
  const meta = user.user_metadata ?? {}
  return (
    (meta.user_name as string | undefined) ??
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "teammate"
  )
}

async function saveSession(team: string, session: Session): Promise<void> {
  await mkdir(SESSIONS_DIR, { recursive: true })
  const stored: StoredSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: { id: session.user.id, email: session.user.email, name: displayNameOf(session.user) },
  }
  await writeFile(sessionPath(team), JSON.stringify(stored, null, 2) + "\n", { mode: 0o600 })
}

export async function clearSession(team: string): Promise<void> {
  for (const path of [sessionPath(team), LEGACY_SESSION_PATH]) {
    try {
      await unlink(path)
    } catch {
      // already gone
    }
  }
}

/**
 * Returns an authenticated client, refreshing and re-saving the session when
 * the access token has expired. Null when sync is not configured or nobody
 * has run `todo login` on this machine.
 */
export async function getAuthedClient(config: SyncConfig | null, team: string, legacyFallback = false): Promise<AuthedClient | null> {
  if (!config) return null
  const stored = await readStoredSession(team, legacyFallback)
  if (!stored) return null

  const client = createServerClient(config)
  const { data, error } = await client.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  })
  if (error || !data.session || !data.user) {
    return null
  }
  if (data.session.access_token !== stored.access_token || !existsSync(sessionPath(team))) {
    await saveSession(team, data.session)
  }
  return { client, user: data.user, displayName: displayNameOf(data.user) }
}

/** Ports the Supabase redirect allow-list covers (http://localhost:300*). */
const LOGIN_PORTS = [3009, 3008, 3007, 3006, 3005]

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
  execFile(cmd, [url], () => {
    // If the browser can't be opened the URL is already printed for the user.
  })
}

/**
 * GitHub sign-in from the terminal: starts a one-shot local HTTP listener,
 * opens the browser to Supabase's OAuth URL, and exchanges the returned code
 * for a session (PKCE, so the code is useless to anyone else).
 */
export async function login(config: SyncConfig, team: string, log: (msg: string) => void = console.log): Promise<StoredSession> {
  const client = createServerClient(config)

  const port = await new Promise<number>((resolve, reject) => {
    let idx = 0
    const tryNext = () => {
      if (idx >= LOGIN_PORTS.length) return reject(new Error("No free port in 3005-3009 for the login callback"))
      const candidate = LOGIN_PORTS[idx++]
      const probe = createServer()
      probe.once("error", () => tryNext())
      probe.listen(candidate, "127.0.0.1", () => probe.close(() => resolve(candidate)))
    }
    tryNext()
  })

  const redirectTo = `http://localhost:${port}/callback`
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error || !data.url) throw new Error(error?.message ?? "Could not start sign-in")

  const session = await new Promise<Session>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`)
      if (url.pathname !== "/callback") {
        res.writeHead(404).end()
        return
      }
      const code = url.searchParams.get("code")
      const errDesc = url.searchParams.get("error_description") ?? url.searchParams.get("error")
      if (!code) {
        res.writeHead(400, { "content-type": "text/plain" }).end(`Sign-in failed: ${errDesc ?? "no code returned"}`)
        server.close()
        reject(new Error(errDesc ?? "Sign-in failed"))
        return
      }
      const exchange = await client.auth.exchangeCodeForSession(code)
      if (exchange.error || !exchange.data.session) {
        res.writeHead(500, { "content-type": "text/plain" }).end(`Sign-in failed: ${exchange.error?.message}`)
        server.close()
        reject(new Error(exchange.error?.message ?? "Code exchange failed"))
        return
      }
      res
        .writeHead(200, { "content-type": "text/html" })
        .end("<body style='font-family:monospace;background:#111;color:#eee;padding:2rem'>Signed in. You can close this tab.</body>")
      server.close()
      resolve(exchange.data.session)
    })
    server.listen(port, "127.0.0.1", () => {
      log(`Opening GitHub sign-in in your browser. If it doesn't open, visit:\n${data.url}`)
      openBrowser(data.url!)
    })
    setTimeout(() => {
      server.close()
      reject(new Error("Timed out waiting for sign-in (5 minutes)"))
    }, 5 * 60 * 1000).unref()
  })

  await saveSession(team, session)
  return (await readStoredSession(team))!
}
