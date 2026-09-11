import { NextResponse } from "next/server"

/** The origin the browser used, honoring a reverse proxy (e.g. tailscale serve). */
function requestOrigin(request: Request): string {
  const h = request.headers
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(request.url).host
  const proto = h.get("x-forwarded-proto") ?? (host.endsWith(":8443") ? "https" : "http")
  return `${proto}://${host}`
}
import { loadTeams } from "@/lib/sync/teams"
import { beginBrowserLogin } from "@/lib/sync/session"

// Start GitHub sign-in for a team from the dashboard. Redirects to Supabase,
// which sends the browser back to /api/teams/callback.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const team = url.searchParams.get("team") ?? ""
  const teams = await loadTeams()
  const config = teams[team]
  if (!config) return NextResponse.json({ error: "Unknown team" }, { status: 404 })

  const redirectTo = `${requestOrigin(request)}/api/teams/callback?team=${encodeURIComponent(team)}`
  try {
    const authUrl = await beginBrowserLogin(config, team, redirectTo)
    return NextResponse.redirect(authUrl)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
