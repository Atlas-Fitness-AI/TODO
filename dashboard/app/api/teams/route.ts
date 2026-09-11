import { NextResponse } from "next/server"
import { loadTeams, addTeam, removeTeam, probeTeam, TEAM_NAME } from "@/lib/sync/teams"
import { readStoredSession, clearSession } from "@/lib/sync/session"
import { invalidateAuth } from "@/lib/sync/server"

// Teams: each one a Supabase project in ~/.fathom/config.json.

export async function GET() {
  const teams = await loadTeams()
  const names = Object.keys(teams)
  const rows = await Promise.all(
    names.map(async (name, i) => {
      const stored = await readStoredSession(name, i === 0)
      return { name, url: teams[name].url, signedIn: stored !== null, user: stored?.user.name ?? null }
    })
  )
  return NextResponse.json({ teams: rows })
}

export async function POST(request: Request) {
  let body: { name?: string; url?: string; publishableKey?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const name = (body.name ?? "").trim()
  const url = (body.url ?? "").trim().replace(/\/+$/, "")
  const publishableKey = (body.publishableKey ?? "").trim()
  if (!TEAM_NAME.test(name)) {
    return NextResponse.json({ error: "Team name: letters, digits, dashes, underscores; up to 32 characters" }, { status: 400 })
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && !/^https?:\/\/.+/i.test(url)) {
    return NextResponse.json({ error: "That doesn't look like a Supabase project URL" }, { status: 400 })
  }
  if (!publishableKey) return NextResponse.json({ error: "Publishable key is required" }, { status: 400 })

  const probe = await probeTeam({ url, publishableKey })
  if (!probe.ok) return NextResponse.json({ error: probe.reason }, { status: 400 })

  try {
    await addTeam(name, { url, publishableKey })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
  return NextResponse.json({ success: true, name })
}

export async function DELETE(request: Request) {
  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const name = (body.name ?? "").trim()
  if (!name) return NextResponse.json({ error: "Team name is required" }, { status: 400 })
  const removed = await removeTeam(name)
  if (!removed) return NextResponse.json({ error: "No such team" }, { status: 404 })
  await clearSession(name)
  invalidateAuth(name)
  return NextResponse.json({ success: true })
}

// Sign out of a team without removing it.
export async function PATCH(request: Request) {
  let body: { name?: string; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const name = (body.name ?? "").trim()
  if (!name || body.action !== "signout") return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
  await clearSession(name)
  invalidateAuth(name)
  return NextResponse.json({ success: true })
}
