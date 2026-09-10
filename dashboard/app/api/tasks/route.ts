import { NextResponse } from "next/server"
import { readFile, writeFile, access } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { parseTodoMarkdown, serializeTodoMarkdown, serializeDoneItem } from "@/lib/parser"
import { upsertFieldInDoneMarkdown } from "@/lib/changelog"
import { readActivityLog } from "@/lib/activity-log"
import type { Priority, Status, Step, TodoItem, AppConfig, ActivityEvent } from "@/lib/types"

const CONFIG_PATH = join(homedir(), ".fathom", "config.json")

const VALID_STATUSES: Status[] = ["Active", "Blocked", "Queued", "Pending", "Resolved"]
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
    case "Active":
      if (!updated.started) updated.started = getToday()
      delete updated.blocked
      break
    case "Blocked":
      if (!updated.blocked) updated.blocked = "Moved via dashboard"
      break
    case "Queued":
    case "Pending":
      delete updated.started
      delete updated.blocked
      break
    case "Resolved":
      updated.completed = getToday()
      if (!updated.resolution) updated.resolution = "Completed via dashboard"
      break
  }

  return updated
}

function getActivityAction(newStatus: Status): { action: string; color: string } {
  switch (newStatus) {
    case "Active":
      return { action: "STARTED", color: "text-blue-400" }
    case "Resolved":
      return { action: "COMPLETED", color: "text-green-400" }
    case "Blocked":
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
    agent: "dashboard",
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
    const { projectPath, title, priority, category, description, status, dependencies, steps, branch } = body as {
      projectPath: string
      title: string
      priority: Priority
      category: string[]
      description?: string
      status?: Status
      dependencies?: string
      steps?: Step[]
      branch?: string
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

    const targetStatus = status || "Queued"
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
      ...(branch?.trim() && { branch: branch.trim() }),
      ...(description?.trim() && { description: description.trim() }),
      ...(dependencies?.trim() && { dependencies: dependencies.trim() }),
      ...(steps && steps.length > 0 && { steps }),
      added: getToday(),
      ...(targetStatus === "Active" && { started: getToday() }),
    }

    const targetSection = parsed.sections.find((s) => s.status === targetStatus)
    if (targetSection) targetSection.items.push(newItem)

    await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, parsed.sections), "utf-8")

    // Log activity
    const logPath = join(projectPath, ".todo-activity.json")
    const existing = await readActivityLog(projectPath)
    const event: ActivityEvent = {
      agent: "dashboard",
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

// Set (or clear, when line is empty) the Changelog field on a task,
// searching TODO.md first and falling back to the archive file.
async function setChangelogLine(projectPath: string, title: string, line: string) {
  if (!(await isRegisteredProject(projectPath))) {
    return NextResponse.json({ error: "Project not registered" }, { status: 403 })
  }

  // Try TODO.md first
  const todoPath = join(projectPath, "TODO.md")
  try {
    const content = await readFile(todoPath, "utf-8")
    const parsed = parseTodoMarkdown(content)
    for (const section of parsed.sections) {
      const index = section.items.findIndex((i) => i.title === title)
      if (index !== -1) {
        const updated = { ...section.items[index] }
        if (line) updated.changelog = line
        else delete updated.changelog
        section.items[index] = updated
        await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, parsed.sections), "utf-8")
        return NextResponse.json({ success: true })
      }
    }
  } catch {
    // fall through to archive
  }

  // Fall back to the archive file (targeted edit preserves formatting)
  const archiveConfig = await getArchiveConfig(projectPath)
  const archivePath = join(projectPath, archiveConfig.archiveFile)
  try {
    const doneContent = await readFile(archivePath, "utf-8")
    const updated = upsertFieldInDoneMarkdown(doneContent, title, "Changelog", line)
    if (updated !== null) {
      await writeFile(archivePath, updated, "utf-8")
      return NextResponse.json({ success: true })
    }
  } catch {
    // archive missing — fall through to 404
  }

  return NextResponse.json({ error: `Task not found: ${title}` }, { status: 404 })
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
    const { projectPath, title, newStatus, newPriority, toggleStep, newBranch, newChangelog } = body as {
      projectPath: string
      title: string
      newStatus?: Status
      newPriority?: Priority
      toggleStep?: number
      newBranch?: string | null // null or "" = unscoped (main)
      newChangelog?: string // consumer-facing release-notes line; "" = remove
    }

    if (!projectPath || !title) {
      return NextResponse.json(
        { error: "projectPath and title are required" },
        { status: 400 }
      )
    }

    if (!newStatus && !newPriority && toggleStep === undefined && newBranch === undefined && newChangelog === undefined) {
      return NextResponse.json(
        { error: "newStatus, newPriority, toggleStep, newBranch, or newChangelog is required" },
        { status: 400 }
      )
    }

    // Handle changelog line edit — the item may live in TODO.md or the archive
    if (newChangelog !== undefined) {
      if (typeof newChangelog !== "string" || newChangelog.includes("\n")) {
        return NextResponse.json(
          { error: "newChangelog must be a single-line string" },
          { status: 400 }
        )
      }
      return setChangelogLine(projectPath, title, newChangelog.trim())
    }

    if (newBranch !== undefined && newBranch !== null && typeof newBranch !== "string") {
      return NextResponse.json(
        { error: "newBranch must be a string or null" },
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

    // Handle step toggle
    if (toggleStep !== undefined) {
      if (!foundItem.steps || toggleStep < 0 || toggleStep >= foundItem.steps.length) {
        return NextResponse.json(
          { error: "Invalid step index" },
          { status: 400 }
        )
      }

      const section = parsed.sections.find((s) => s.status === foundSection)!
      const updatedSteps = foundItem.steps.map((step, i) =>
        i === toggleStep ? { ...step, completed: !step.completed } : step
      )
      section.items[foundIndex] = { ...foundItem, steps: updatedSteps }

      await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, parsed.sections), "utf-8")

      const toggledStep = updatedSteps[toggleStep]
      const logPath = join(projectPath, ".todo-activity.json")
      const existing = await readActivityLog(projectPath)
      const event: ActivityEvent = {
      agent: "dashboard",
        date: new Date().toISOString(),
        action: "UPDATED",
        title,
        detail: `Step ${toggledStep.completed ? "completed" : "unchecked"}: ${toggledStep.title}`,
        color: "text-purple-400",
      }
      await writeFile(logPath, JSON.stringify([event, ...existing].slice(0, 50), null, 2), "utf-8")

      return NextResponse.json({ success: true })
    }

    // Handle branch move (null/empty = back to main)
    if (newBranch !== undefined) {
      const target = newBranch?.trim() || undefined
      if (target && /[\s]/.test(target)) {
        return NextResponse.json(
          { error: "Branch names cannot contain whitespace" },
          { status: 400 }
        )
      }
      if ((foundItem.branch ?? undefined) === target) {
        return NextResponse.json(
          { error: "Task is already on that branch" },
          { status: 400 }
        )
      }

      const oldBranch = foundItem.branch
      const section = parsed.sections.find((s) => s.status === foundSection)!
      const updated: TodoItem = { ...foundItem }
      if (target) updated.branch = target
      else delete updated.branch
      section.items[foundIndex] = updated

      await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, parsed.sections), "utf-8")

      const logPath = join(projectPath, ".todo-activity.json")
      const existing = await readActivityLog(projectPath)
      const event: ActivityEvent = {
      agent: "dashboard",
        date: new Date().toISOString(),
        action: "MOVED",
        title,
        detail: `Branch ${oldBranch ?? "main"} → ${target ?? "main"}`,
        color: "text-yellow-400",
      }
      await writeFile(logPath, JSON.stringify([event, ...existing].slice(0, 50), null, 2), "utf-8")

      return NextResponse.json({ success: true })
    }

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
      agent: "dashboard",
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
      if (newStatus === "Resolved") {
        const archiveConfig = await getArchiveConfig(projectPath)

        if (archiveConfig.archive) {
          const filteredSections = parsed.sections.map((s) =>
            s.status === "Resolved" ? { ...s, items: s.items.filter((i) => i.title !== title) } : s
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
          const doneSection = parsed.sections.find((s) => s.status === "Resolved")
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

// Delete a task or clear activity log
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { projectPath, title, clearStatus } = body as { projectPath: string; title?: string; clearStatus?: Status }

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

    // Clear all tasks in a status group
    if (clearStatus) {
      if (!VALID_STATUSES.includes(clearStatus)) {
        return NextResponse.json(
          { error: `Invalid status: ${clearStatus}` },
          { status: 400 }
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

      const section = parsed.sections.find((s) => s.status === clearStatus)
      const count = section?.items.length ?? 0
      if (section) section.items = []

      await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, parsed.sections), "utf-8")

      if (count > 0) {
        const logPath = join(projectPath, ".todo-activity.json")
        const existing = await readActivityLog(projectPath)
        const event: ActivityEvent = {
      agent: "dashboard",
          date: new Date().toISOString(),
          action: "DELETED",
          title: `${count} task${count !== 1 ? "s" : ""}`,
          detail: `Cleared ${clearStatus}`,
          color: "text-red-400",
        }
        await writeFile(logPath, JSON.stringify([event, ...existing].slice(0, 50), null, 2), "utf-8")
      }

      return NextResponse.json({ success: true })
    }

    // If title is provided, delete that task; otherwise clear activity log
    if (title) {
      const result = await loadAndFindTask(projectPath, title)
      if ("error" in result) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status }
        )
      }

      const { parsed, todoPath, foundSection, foundIndex } = result

      const section = parsed.sections.find((s) => s.status === foundSection)!
      section.items.splice(foundIndex, 1)

      await writeFile(todoPath, serializeTodoMarkdown(parsed.projectName, parsed.sections), "utf-8")

      // Log activity
      const logPath = join(projectPath, ".todo-activity.json")
      const existing = await readActivityLog(projectPath)
      const event: ActivityEvent = {
      agent: "dashboard",
        date: new Date().toISOString(),
        action: "DELETED",
        title,
        detail: `Removed from ${foundSection}`,
        color: "text-red-400",
      }
      await writeFile(logPath, JSON.stringify([event, ...existing].slice(0, 50), null, 2), "utf-8")

      return NextResponse.json({ success: true })
    }

    const logPath = join(projectPath, ".todo-activity.json")
    await writeFile(logPath, "[]", "utf-8")

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 500 }
    )
  }
}
