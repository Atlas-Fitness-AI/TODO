import type { TodoItem, TodoSection, Priority, Status } from "./types"

const VALID_STATUSES: Status[] = [
  "In Progress",
  "Stuck",
  "Ready",
  "Backlog",
  "Done",
]

const VALID_PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"]

export function parseTodoMarkdown(content: string): {
  projectName: string
  sections: TodoSection[]
} {
  if (!content || typeof content !== "string") {
    return {
      projectName: "Unknown Project",
      sections: VALID_STATUSES.map((status) => ({ status, items: [] })),
    }
  }

  const lines = content.split("\n")

  // Extract project name from "> Project: [name]"
  let projectName = "Unknown Project"
  for (const line of lines) {
    const match = line.match(/^>\s*Project:\s*(.+)/)
    if (match) {
      projectName = match[1].trim()
      break
    }
  }

  // Split into sections by ## headings
  const sections: TodoSection[] = []
  let currentStatus: Status | null = null
  let currentItems: string[] = []

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)/)
    if (sectionMatch) {
      // Save previous section
      if (currentStatus) {
        sections.push({
          status: currentStatus,
          items: parseItems(currentItems.join("\n"), currentStatus),
        })
      }

      const heading = sectionMatch[1].trim()
      // Match against valid statuses — allow trailing text like "(3 items)"
      const matchedStatus = VALID_STATUSES.find(
        (s) =>
          s.toLowerCase() === heading.toLowerCase() ||
          heading.toLowerCase().startsWith(s.toLowerCase())
      )

      if (matchedStatus) {
        currentStatus = matchedStatus
        currentItems = []
      } else {
        currentStatus = null
        currentItems = []
      }
    } else if (currentStatus) {
      currentItems.push(line)
    }
  }

  // Save last section
  if (currentStatus) {
    sections.push({
      status: currentStatus,
      items: parseItems(currentItems.join("\n"), currentStatus),
    })
  }

  // Ensure all statuses are represented
  for (const status of VALID_STATUSES) {
    if (!sections.find((s) => s.status === status)) {
      sections.push({ status, items: [] })
    }
  }

  // Sort sections in display order
  sections.sort(
    (a, b) => VALID_STATUSES.indexOf(a.status) - VALID_STATUSES.indexOf(b.status)
  )

  return { projectName, sections }
}

function parseItems(content: string, status: Status): TodoItem[] {
  // Split by ### headings to get individual items
  const itemBlocks = content.split(/(?=^###\s)/m).filter((block) => block.trim())
  const items: TodoItem[] = []

  for (const block of itemBlocks) {
    try {
      const lines = block.split("\n")
      const titleMatch = lines[0]?.match(/^###\s+(.+)/)
      if (!titleMatch) continue

      const title = titleMatch[1].trim()
      if (!title) continue

      const fields = parseFields(lines.slice(1))

      const priority = VALID_PRIORITIES.includes(fields.priority as Priority)
        ? (fields.priority as Priority)
        : "Medium"

      const category = fields.category
        ? fields.category.split(",").map((c: string) => c.trim()).filter(Boolean)
        : []

      const files = fields.files
        ? fields.files
            .split(",")
            .map((f: string) => f.trim().replace(/`/g, ""))
            .filter(Boolean)
        : undefined

      const item: TodoItem = {
        title,
        priority,
        category,
        status,
        ...(fields.description && { description: fields.description }),
        ...(files && files.length > 0 && { files }),
        ...(fields.context && { context: fields.context }),
        ...(fields.acceptance && { acceptance: fields.acceptance }),
        ...(fields.code && { code: fields.code }),
        ...(fields.dependencies && { dependencies: fields.dependencies }),
        ...(fields.added && { added: fields.added }),
        ...(fields.started && { started: fields.started }),
        ...(fields.completed && { completed: fields.completed }),
        ...(fields.resolution && { resolution: fields.resolution }),
        ...(fields.blocked && { blocked: fields.blocked }),
      }

      items.push(item)
    } catch {
      // Skip malformed items — don't let one bad item kill the section
      continue
    }
  }

  return items
}

function parseFields(lines: string[]): Record<string, string> {
  const fields: Record<string, string> = {}

  for (const line of lines) {
    const match = line.match(/^-\s+\*\*([^*]+)\*\*:\s*(.*)/)
    if (match) {
      const value = match[2].trim()
      if (value) {
        fields[match[1].trim().toLowerCase()] = value
      }
    }
  }

  return fields
}

export function parseDoneMarkdown(content: string): TodoItem[] {
  if (!content || typeof content !== "string") {
    return []
  }

  const itemBlocks = content.split(/(?=^###\s)/m).filter((block) => block.trim())
  const items: TodoItem[] = []

  for (const block of itemBlocks) {
    try {
      const lines = block.split("\n")
      const titleMatch = lines[0]?.match(/^###\s+(.+)/)
      if (!titleMatch) continue

      const title = titleMatch[1].trim()
      if (!title) continue

      const fields = parseFields(lines.slice(1))

      const priority = VALID_PRIORITIES.includes(fields.priority as Priority)
        ? (fields.priority as Priority)
        : "Medium"

      const category = fields.category
        ? fields.category.split(",").map((c: string) => c.trim()).filter(Boolean)
        : []

      const files = fields.files
        ? fields.files
            .split(",")
            .map((f: string) => f.trim().replace(/`/g, ""))
            .filter(Boolean)
        : undefined

      items.push({
        title,
        priority,
        category,
        status: "Done",
        ...(fields.description && { description: fields.description }),
        ...(files && files.length > 0 && { files }),
        ...(fields.context && { context: fields.context }),
        ...(fields.acceptance && { acceptance: fields.acceptance }),
        ...(fields.added && { added: fields.added }),
        ...(fields.started && { started: fields.started }),
        ...(fields.completed && { completed: fields.completed }),
        ...(fields.resolution && { resolution: fields.resolution }),
      })
    } catch {
      // Skip malformed items
      continue
    }
  }

  return items
}

export function getTotalItemCount(sections: TodoSection[]): number {
  return sections.reduce((sum, section) => sum + section.items.length, 0)
}

export function getActiveItemCount(sections: TodoSection[]): number {
  return sections
    .filter((s) => s.status !== "Done")
    .reduce((sum, section) => sum + section.items.length, 0)
}
