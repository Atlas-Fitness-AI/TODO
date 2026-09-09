import { NextResponse } from "next/server"
import { readFile, writeFile, access, mkdir } from "fs/promises"
import { join, basename } from "path"
import { homedir } from "os"
import { loadAllProjects } from "@/lib/projects"
import { readActivityLog } from "@/lib/activity-log"

const CONFIG_DIR = join(homedir(), ".atlas-todo")
const CONFIG_PATH = join(CONFIG_DIR, "config.json")

interface ProjectConfig {
  name: string
  path: string
}

interface AppConfig {
  projects: ProjectConfig[]
}

async function loadConfig(): Promise<AppConfig> {
  try {
    await access(CONFIG_PATH)
    const raw = await readFile(CONFIG_PATH, "utf-8")
    return JSON.parse(raw) as AppConfig
  } catch {
    return { projects: [] }
  }
}

async function validateProject(trimmedPath: string) {
  // Validate the path exists on the filesystem
  try {
    await access(trimmedPath)
  } catch {
    return { error: "Path does not exist on the filesystem" }
  }

  // Check for TODO.md
  const todoPath = join(trimmedPath, "TODO.md")
  let derivedName: string | null = null

  try {
    await access(todoPath)
    const content = await readFile(todoPath, "utf-8")
    const match = content.match(/^>\s*Project:\s*(.+)$/m)
    if (match) {
      derivedName = match[1].trim()
    }
  } catch {
    return { error: "No TODO.md found in this directory" }
  }

  // Check for duplicates
  const config = await loadConfig()
  const alreadyExists = config.projects.some(
    (p) => p.path === trimmedPath
  )
  if (alreadyExists) {
    return { error: "This project is already registered" }
  }

  return {
    derivedName: derivedName || basename(trimmedPath),
    config,
  }
}

// Get all parsed projects (with activity diffing)
export async function GET() {
  try {
    const projects = await loadAllProjects()

    // Attach activity log to each project
    for (const project of projects) {
      project.activity = await readActivityLog(project.path)
    }

    return NextResponse.json(projects)
  } catch {
    return NextResponse.json(
      { error: "Failed to load projects" },
      { status: 500 }
    )
  }
}

// Validate a path without adding it
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { path: projectPath } = body as { path: string }

    if (!projectPath || typeof projectPath !== "string") {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      )
    }

    const result = await validateProject(projectPath.trim())

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ name: result.derivedName })
  } catch {
    return NextResponse.json(
      { error: "Failed to validate path" },
      { status: 500 }
    )
  }
}

// Add a project
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { path: projectPath, name } = body as {
      path: string
      name?: string
    }

    if (!projectPath || typeof projectPath !== "string") {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      )
    }

    const trimmedPath = projectPath.trim()
    const result = await validateProject(trimmedPath)

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    const projectName = name?.trim() || result.derivedName

    const newProject: ProjectConfig = {
      name: projectName,
      path: trimmedPath,
    }
    result.config.projects.push(newProject)

    await mkdir(CONFIG_DIR, { recursive: true })
    await writeFile(
      CONFIG_PATH,
      JSON.stringify(result.config, null, 2),
      "utf-8"
    )

    return NextResponse.json({ project: newProject })
  } catch {
    return NextResponse.json(
      { error: "Failed to add project" },
      { status: 500 }
    )
  }
}

// Rename a project
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { path: projectPath, name } = body as { path: string; name: string }

    if (!projectPath || typeof projectPath !== "string") {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      )
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      )
    }

    const config = await loadConfig()
    const project = config.projects.find((p) => p.path === projectPath)

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    project.name = name.trim()

    await mkdir(CONFIG_DIR, { recursive: true })
    await writeFile(
      CONFIG_PATH,
      JSON.stringify(config, null, 2),
      "utf-8"
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Failed to rename project" },
      { status: 500 }
    )
  }
}

// Remove a project
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { path: projectPath } = body as { path: string }

    if (!projectPath || typeof projectPath !== "string") {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      )
    }

    const config = await loadConfig()
    const index = config.projects.findIndex((p) => p.path === projectPath)

    if (index === -1) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    config.projects.splice(index, 1)

    await mkdir(CONFIG_DIR, { recursive: true })
    await writeFile(
      CONFIG_PATH,
      JSON.stringify(config, null, 2),
      "utf-8"
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Failed to remove project" },
      { status: 500 }
    )
  }
}
