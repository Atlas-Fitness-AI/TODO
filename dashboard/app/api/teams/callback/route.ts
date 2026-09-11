import { NextResponse } from "next/server"

/** The origin the browser used, honoring a reverse proxy (e.g. tailscale serve). */
function requestOrigin(request: Request): string {
  const h = request.headers
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(request.url).host
  const proto = h.get("x-forwarded-proto") ?? (host.endsWith(":8443") ? "https" : "http")
  return `${proto}://${host}`
}
import { completeBrowserLogin } from "@/lib/sync/session"
import { invalidateAuth } from "@/lib/sync/server"

// Second half of the dashboard sign-in: exchange the code, store the session
// for the dashboard server (and the fathom CLI), select the team, go home.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const team = url.searchParams.get("team") ?? ""
  const code = url.searchParams.get("code")
  const errDesc = url.searchParams.get("error_description") ?? url.searchParams.get("error")
  const home = new URL("/", requestOrigin(request))

  if (!code) {
    home.searchParams.set("signin", `failed: ${errDesc ?? "no code returned"}`)
    return NextResponse.redirect(home)
  }
  try {
    const session = await completeBrowserLogin(team, code)
    invalidateAuth(team)
    home.searchParams.set("signin", `ok: ${session.user.name ?? session.user.email ?? "signed in"}`)
    const res = NextResponse.redirect(home)
    res.cookies.set("selected_team", team, { path: "/", maxAge: 60 * 60 * 24 * 365 })
    return res
  } catch (err) {
    home.searchParams.set("signin", `failed: ${(err as Error).message}`)
    return NextResponse.redirect(home)
  }
}
