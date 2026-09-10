import { NextResponse } from "next/server"
import { getServerAuth, defaultTeam } from "@/lib/sync/server"

const PETS = ["cat", "dog", "frog", "octopus", "owl", "snail", "robot", "dragon", "penguin", "ghost", "crab", "bat"]

// Update the signed-in member's own profile (team sync only).
export async function PATCH(request: Request) {
  let body: { pet?: string | null; team?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const auth = await getServerAuth(body.team ?? (await defaultTeam()))
  if (!auth) return NextResponse.json({ error: "Not signed in to team sync" }, { status: 401 })
  if (body.pet !== null && (typeof body.pet !== "string" || !PETS.includes(body.pet))) {
    return NextResponse.json({ error: "Unknown pet" }, { status: 400 })
  }

  const { error } = await auth.client.from("profiles").update({ pet: body.pet }).eq("id", auth.user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, pet: body.pet })
}
