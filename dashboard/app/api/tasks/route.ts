import { NextResponse } from "next/server"
import { readFile, writeFile, access } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { parseTodoMarkdown, serializeTodoMarkdown, serializeDoneItem } from "@/lib/parser"
import { readActivityLog } from "@/lib/activity-log"
import type { Priority, Status, TodoItem, AppConfig, ActivityEvent } from "@/lib/types"

const CONFIG_PATH = join(homedir(), ".claudedo", "config.json")

const VALID_STATUSES: Status[] = ["In Progress", "Stuck", "Ready", "Backlog", "Done"]
const VALID_PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"]

async function isRegisteredProject(projectPath: string): Promise<boolean> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8")
    const config: AppConfig = JSON.parse(raw)
    return config.projects.some((p) => p.path === projectPath)
  } catch {
    return false
  }
}

function getToday(): string {
  return new Date().toISOString().split("T")[0]
}

function applyStatusFields(item: TodoItem, oldStatus: Status, newStatus: Status): TodoItem {
  const updated = { ...item, status: newStatus }

  switch (newStatus) {
    case "In Progress":
      if (!updated.started) updated.started = getToday()
      delete updated.blocked
      break
    case "Stuck":
      if (!updated.blocked) updated.blocked = "Moved via dashboard"
      break
    case "Ready":
    case "Backlog":
      delete updated.started
      delete updated.blocked
      break
    case "Done":
      updated.completed = getToday()
      if (!updated.resolution) updated.resolution = "Completed via dashboard"
      break
  }

  return updated
}

function getActivityAction(newStatus: Status): { action: string; color: string } {
  switch (newStatus) {
    case "In Progress":
      return { action: "STARTED", color: "text-blue-400" }
    case "Done":
      return { action: "COMPLETED", color: "text-green-400" }
    case "Stuck":
      return { action: "BLOCKED", color: "text-red-400" }
    default:
      return { action: "MOVED", color: "text-yellow-400" }
  }
}

async function logActivity(
  projectPath: string,
  title: string,
  oldStatus: Status,
  newStatus: Status
) {
  const logPath = join(projectPath, ".todo-activity.json")
  const existing = await readActivityLog(projectPath)
  const { action, color } = getActivityAction(newStatus)

  const event: ActivityEvent = {
    date: new Date().toISOString(),
    action,
    title,
    detail: `${oldStatus} → ${newStatus}`,
    color,
  }

  const updated = [event, ...existing].slice(0, 50)
  await writeFile(logPath, JSON.stringify(updated, null, 2), "utf-8")
}

async function getArchiveConfig(projectPath: string): Promise<{ archive: boolean; archiveFile: string }> {
  try {
    const rulesPath = join(projectPath, "TODORULES.md")
    if (!existsSync(rulesPath)) return { archive: false, archiveFile: "DONE.md" }
    const content = await readFile(rulesPath, "utf-8")
    const archiveMatch = content.match(/^archive:\s*(true|false)/m)
    const fileMatch = content.match(/^archive_file:\s*(.+)/m)
    return {
      archive: archiveMatch ? archiveMatch[1] === "true" : false,
      archiveFile: fileMatch ? fileMatch[1].trim() : "DONE.md",
    }
  } catch {
    return { archive: false, archiveFile: "DONE.md" }
  }
}

// Add a new task
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectPath, title, priority, category, description, status } = body as {
      projectPath: string
      title: string
      priority: Priority
      category: string[]
      description?: string
      status?: Status
    }

    if (!projectPath || !title?.trim()) {
      return NextResponse.json(
        { error: "projectPath and title are required" },
        { status: 400 }
      )
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority: ${priority}` },
        { status: 400 }
      )
    }

    const targetStatus = status || "Ready"
    if (!VALID_STATUSES.includes(targetStatus)) {
      return NextResponse.json(
        { error: `Invalid status: ${targetStatus}` },
        { status: 400 }
      )
    }

    if (!(await isRegisteredProject(projectPath))) {
      return NextResponse.json(
        { error: "Project not registered" },
        { status: 403 }
      )
    }

    const todoPath = join(projectPath, "TODO.md")
    try {
      await access(todoPath)
    } catch {
      return NextResponse.json(
        { error: "TODO.md not found" },
        { status: 404 }
      )
    }

    const content = await readFile(todoPath, "utf-8")
    const parsed = parseTodoMarkdown(content)

    const newItem: TodoItem = {
      title: title.trim(),
      priority,
      category: category || [],
      status: targetStatus,
      ...(description?.trim() && { description: description.trim() }),
      added: getToday(),
      ...(targetStatus === "In Progress" && { started: getToday() }),
    }

    const targetSection = parsed.sections.find((s) => s.status === targetStatus)
    if (targetSection) targetSection.items.push(newItem)

    await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, parsed.sections), "utf-8")

    // Log activity
    const logPath = join(projectPath, ".todo-activity.json")
    const existing = await readActivityLog(projectPath)
    const event: ActivityEvent = {
      date: new Date().toISOString(),
      action: "ADDED",
      title: title.trim(),
      detail: `Added to ${targetStatus}`,
      color: "text-green-400",
    }
    await writeFile(logPath, JSON.stringify([event, ...existing].slice(0, 50), null, 2), "utf-8")

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Failed to add task" },
      { status: 500 }
    )
  }
}

async function loadAndFindTask(projectPath: string, title: string) {
  if (!(await isRegisteredProject(projectPath))) {
    return { error: "Project not registered", status: 403 }
  }

  const todoPath = join(projectPath, "TODO.md")
  try {
    await access(todoPath)
  } catch {
    return { error: "TODO.md not found", status: 404 }
  }

  const content = await readFile(todoPath, "utf-8")
  const parsed = parseTodoMarkdown(content)

  let foundItem: TodoItem | null = null
  let foundSection: Status | null = null
  let foundIndex = -1

  for (const section of parsed.sections) {
    const index = section.items.findIndex((i) => i.title === title)
    if (index !== -1) {
      foundItem = section.items[index]
      foundSection = section.status
      foundIndex = index
      break
    }
  }

  if (!foundItem || !foundSection) {
    return { error: `Task not found: ${title}`, status: 404 }
  }

  return { parsed, todoPath, foundItem, foundSection, foundIndex }
}

// Update a task (move status or change priority)
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { projectPath, title, newStatus, newPriority } = body as {
      projectPath: string
      title: string
      newStatus?: Status
      newPriority?: Priority
    }

    if (!projectPath || !title) {
      return NextResponse.json(
        { error: "projectPath and title are required" },
        { status: 400 }
      )
    }

    if (!newStatus && !newPriority) {
      return NextResponse.json(
        { error: "newStatus or newPriority is required" },
        { status: 400 }
      )
    }

    if (newStatus && !VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status: ${newStatus}` },
        { status: 400 }
      )
    }

    if (newPriority && !VALID_PRIORITIES.includes(newPriority)) {
      return NextResponse.json(
        { error: `Invalid priority: ${newPriority}` },
        { status: 400 }
      )
    }

    const result = await loadAndFindTask(projectPath, title)
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    const { parsed, todoPath, foundItem, foundSection, foundIndex } = result

    // Handle priority change
    if (newPriority && !newStatus) {
      if (foundItem.priority === newPriority) {
        return NextResponse.json(
          { error: "Task already has that priority" },
          { status: 400 }
        )
      }

      const oldPriority = foundItem.priority
      const section = parsed.sections.find((s) => s.status === foundSection)!
      section.items[foundIndex] = { ...foundItem, priority: newPriority }

      await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, parsed.sections), "utf-8")

      // Log activity
      const logPath = join(projectPath, ".todo-activity.json")
      const existing = await readActivityLog(projectPath)
      const event: ActivityEvent = {
        date: new Date().toISOString(),
        action: "UPDATED",
        title,
        detail: `Priority ${oldPriority} → ${newPriority}`,
        color: "text-purple-400",
      }
      await writeFile(logPath, JSON.stringify([event, ...existing].slice(0, 50), null, 2), "utf-8")

      return NextResponse.json({ success: true })
    }

    // Handle status move
    if (newStatus) {
      if (foundSection === newStatus) {
        return NextResponse.json(
          { error: "Task is already in that status" },
          { status: 400 }
        )
      }

      // Remove from current section
      const currentSection = parsed.sections.find((s) => s.status === foundSection)!
      currentSection.items.splice(foundIndex, 1)

      const updatedItem = applyStatusFields(foundItem, foundSection, newStatus)

      // Handle Done with archiving
      if (newStatus === "Done") {
        const archiveConfig = await getArchiveConfig(projectPath)

        if (archiveConfig.archive) {
          const filteredSections = parsed.sections.map((s) =>
            s.status === "Done" ? { ...s, items: s.items.filter((i) => i.title !== title) } : s
          )
          await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, filteredSections), "utf-8")

          const archivePath = join(projectPath, archiveConfig.archiveFile)
          let archiveContent = ""
          try {
            archiveContent = await readFile(archivePath, "utf-8")
          } catch {
            archiveContent = `# Done\n\n> Completed TODO items archived from TODO.md.\n\n---\n`
          }

          const serializedItem = serializeDoneItem(updatedItem)
          const insertPoint = archiveContent.indexOf("---")
          if (insertPoint !== -1) {
            const afterSep = insertPoint + 3
            archiveContent =
              archiveContent.slice(0, afterSep) +
              "\n\n" +
              serializedItem +
              "\n" +
              archiveContent.slice(afterSep)
          } else {
            archiveContent += "\n" + serializedItem + "\n"
          }

          await writeFile(archivePath, archiveContent, "utf-8")
        } else {
          const doneSection = parsed.sections.find((s) => s.status === "Done")
          if (doneSection) doneSection.items.unshift(updatedItem)
          await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, parsed.sections), "utf-8")
        }
      } else {
        const targetSection = parsed.sections.find((s) => s.status === newStatus)
        if (targetSection) targetSection.items.push(updatedItem)
        await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, parsed.sections), "utf-8")
      }

      await logActivity(projectPath, title, foundSection, newStatus)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "No changes specified" }, { status: 400 })
  } catch {
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    )
  }
}

// Clear activity log
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { projectPath } = body as { projectPath: string }

    if (!projectPath) {
      return NextResponse.json(
        { error: "projectPath is required" },
        { status: 400 }
      )
    }

    if (!(await isRegisteredProject(projectPath))) {
      return NextResponse.json(
        { error: "Project not registered" },
        { status: 403 }
      )
    }

    const logPath = join(projectPath, ".todo-activity.json")
    await writeFile(logPath, "[]", "utf-8")

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Failed to clear activity log" },
      { status: 500 }
    )
  }
}
