import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { value: string | undefined; expires: number }>()

/**
 * Normalize a git remote URL into a stable, machine-independent project key.
 * All of these map to `github.com/org/repo`:
 *   git@github.com:Org/Repo.git
 *   https://github.com/org/repo
 *   ssh://git@github.com/org/repo.git
 */
export function normalizeRemote(raw: string): string | undefined {
  let url = raw.trim()
  if (!url) return undefined

  // scp-like syntax: user@host:path
  const scp = url.match(/^(?:[^@/]+@)?([^:/]+):(?!\/\/)(.+)$/)
  if (scp) {
    url = `${scp[1]}/${scp[2]}`
  } else {
    url = url.replace(/^[a-z+]+:\/\//i, "") // protocol
    url = url.replace(/^[^@/]+@/, "") // credentials
  }

  url = url.replace(/:\d+\//, "/") // port
  url = url.replace(/\/+$/, "")
  url = url.replace(/\.git$/i, "")
  url = url.replace(/\/+$/, "")

  const slash = url.indexOf("/")
  if (slash === -1) return undefined
  // Lowercase the whole key: GitHub paths are case-insensitive, and two
  // teammates must land on the same row regardless of how they cloned.
  const host = url.slice(0, slash).toLowerCase()
  const path = url.slice(slash + 1).toLowerCase()
  return path ? `${host}/${path}` : undefined
}

/** Resolve and normalize a project's `origin` remote, cached per path. */
export async function getProjectRemote(projectPath: string): Promise<string | undefined> {
  const hit = cache.get(projectPath)
  if (hit && hit.expires > Date.now()) return hit.value

  let value: string | undefined
  try {
    const { stdout } = await execFileAsync("git", ["-C", projectPath, "remote", "get-url", "origin"], {
      timeout: 3000,
    })
    value = normalizeRemote(stdout)
  } catch {
    value = undefined
  }

  cache.set(projectPath, { value, expires: Date.now() + CACHE_TTL_MS })
  return value
}
