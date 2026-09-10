import { NextResponse } from "next/server"
import { readFile, writeFile } from "fs/promises"
import { join } from "path"
import { homedir } from "os"
import { parseTodoMarkdown, parseDoneMarkdown, serializeTodoMarkdown } from "@/lib/parser"
import {
  isPendingEntry,
  buildReleaseMarkdown,
  prependReleaseSection,
  upsertFieldInDoneMarkdown,
} from "@/lib/changelog"
import { readActivityLog } from "@/lib/activity-log"
import type { AppConfig, ActivityEvent, TodoItem } from "@/lib/types"

const CONFIG_PATH = join(homedir(), ".atlas-todo", "config.json")

async function isRegisteredProject(projectPath: string): Promise<boolean> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8")
    const config: AppConfig = JSON.parse(raw)
    return config.projects.some((p) => p.path === projectPath)
  } catch {
    return false
  }
}

async function getArchiveFile(projectPath: string): Promise<string> {
  try {
    const rules = await readFile(join(projectPath, "TODORULES.md"), "utf-8")
    const match = rules.match(/^archive_file:\s*(.+)/m)
    if (match) return match[1].trim()
  } catch {
    // defaults below
  }
  return "DONE.md"
}

// Cut a release: gather pending changelog entries in the given branch scope,
// prepend a version section to CHANGELOG.md, and stamp every in-scope
// resolved item (logged or not) with the version so it never resurfaces.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectPath, version, branch } = body as {
      projectPath: string
      version: string
      branch?: string | null // null/absent = main (unscoped items)
    }

    if (!projectPath || !version?.trim()) {
      return NextResponse.json(
        { error: "projectPath and version are required" },
        { status: 400 }
      )
    }
    const cleanVersion = version.trim()
    if (/[\r\n]/.test(cleanVersion) || cleanVersion.length > 50) {
      return NextResponse.json({ error: "Invalid version" }, { status: 400 })
    }
    if (!(await isRegisteredProject(projectPath))) {
      return NextResponse.json({ error: "Project not registered" }, { status: 403 })
    }

    const targetBranch = branch?.trim() || null
    const inScope = (i: TodoItem) =>
      targetBranch ? i.branch === targetBranch : !i.branch

    // Load TODO.md (required) and the archive (optional)
    const todoPath = join(projectPath, "TODO.md")
    let todoContent: string
    try {
      todoContent = await readFile(todoPath, "utf-8")
    } catch {
      return NextResponse.json({ error: "TODO.md not found" }, { status: 404 })
    }
    const parsed = parseTodoMarkdown(todoContent)

    const archivePath = join(projectPath, await getArchiveFile(projectPath))
    let doneContent: string | null = null
    let doneItems: TodoItem[] = []
    try {
      doneContent = await readFile(archivePath, "utf-8")
      doneItems = parseDoneMarkdown(doneContent)
    } catch {
      // no archive file — fine
    }

    const resolvedSection = parsed.sections.find((s) => s.status === "Resolved")
    const todoResolved = (resolvedSection?.items ?? []).filter(inScope)
    const archiveResolved = doneItems.filter(inScope)

    // Dedupe by title, TODO.md wins
    const seen = new Set(todoResolved.map((i) => i.title))
    const allScoped = [
      ...todoResolved,
      ...archiveResolved.filter((i) => !seen.has(i.title)),
    ]

    const pending = allScoped.filter(isPendingEntry)
    if (pending.length === 0) {
      return NextResponse.json(
        { error: "No pending changelog entries to release" },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().split("T")[0]
    const section = buildReleaseMarkdown(cleanVersion, today, targetBranch, pending)

    // Write CHANGELOG.md (newest release first)
    const changelogPath = join(projectPath, "CHANGELOG.md")
    let existingChangelog: string | null = null
    try {
      existingChangelog = await readFile(changelogPath, "utf-8")
    } catch {
      // will be created
    }
    await writeFile(changelogPath, prependReleaseSection(existingChangelog, section), "utf-8")

    // Stamp TODO.md resolved items in scope
    let todoDirty = false
    if (resolvedSection) {
      resolvedSection.items = resolvedSection.items.map((item) => {
        if (inScope(item) && !item.released) {
          todoDirty = true
          return { ...item, released: cleanVersion }
        }
        return item
      })
    }
    if (todoDirty) {
      await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, parsed.sections), "utf-8")
    }

    // Stamp archive items in scope (targeted edits preserve formatting)
    if (doneContent !== null) {
      let updated = doneContent
      for (const item of archiveResolved) {
        if (item.released) continue
        const next = upsertFieldInDoneMarkdown(updated, item.title, "Released", cleanVersion)
        if (next !== null) updated = next
      }
      if (updated !== doneContent) {
        await writeFile(archivePath, updated, "utf-8")
      }
    }

    // Log activity
    const logPath = join(projectPath, ".todo-activity.json")
    const existing = await readActivityLog(projectPath)
    const event: ActivityEvent = {
      agent: "dashboard",
      date: new Date().toISOString(),
      action: "RELEASED",
      title: cleanVersion,
      detail: `${pending.length} change${pending.length === 1 ? "" : "s"} → CHANGELOG.md${targetBranch ? ` (${targetBranch})` : ""}`,
      color: "text-green-400",
    }
    await writeFile(logPath, JSON.stringify([event, ...existing].slice(0, 50), null, 2), "utf-8")

    return NextResponse.json({ success: true, count: pending.length, markdown: section })
  } catch {
    return NextResponse.json({ error: "Failed to cut release" }, { status: 500 })
  }
}
