import { NextResponse } from "next/server"
import { exec } from "child_process"
import { access } from "fs/promises"
import { readFile } from "fs/promises"
import { join } from "path"
import { homedir } from "os"

const CONFIG_PATH = join(homedir(), ".claudedo", "config.json")

async function isRegisteredProject(path: string): Promise<boolean> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8")
    const config = JSON.parse(raw)
    return Array.isArray(config.projects) && config.projects.some((p: { path: string }) => p.path === path)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { path, target } = body as { path: string; target: "finder" | "terminal" }

    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
    }

    if (!target || !["finder", "terminal"].includes(target)) {
      return NextResponse.json({ error: "Target must be 'finder' or 'terminal'" }, { status: 400 })
    }

    // Validate path exists on disk
    try {
      await access(path)
    } catch {
      return NextResponse.json({ error: "Path does not exist" }, { status: 400 })
    }

    // Validate it's a registered project
    if (!(await isRegisteredProject(path))) {
      return NextResponse.json({ error: "Not a registered project" }, { status: 403 })
    }

    const command = target === "finder"
      ? `open "${path}"`
      : `open -a Terminal "${path}"`

    await new Promise<void>((resolve, reject) => {
      exec(command, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to open" }, { status: 500 })
  }
}
