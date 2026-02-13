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

const FIELD_ORDER = [
  "priority",
  "category",
  "files",
  "description",
  "context",
  "acceptance",
  "code",
  "dependencies",
  "added",
  "started",
  "completed",
  "resolution",
  "blocked",
] as const

function serializeItem(item: TodoItem): string {
  const lines: string[] = [`### ${item.title}`]

  for (const field of FIELD_ORDER) {
    switch (field) {
      case "priority":
        lines.push(`- **Priority**: ${item.priority}`)
        break
      case "category":
        if (item.category.length > 0) lines.push(`- **Category**: ${item.category.join(", ")}`)
        break
      case "files":
        if (item.files && item.files.length > 0)
          lines.push(`- **Files**: ${item.files.map((f) => `\`${f}\``).join(", ")}`)
        break
      case "description":
        if (item.description) lines.push(`- **Description**: ${item.description}`)
        break
      case "context":
        if (item.context) lines.push(`- **Context**: ${item.context}`)
        break
      case "acceptance":
        if (item.acceptance) lines.push(`- **Acceptance**: ${item.acceptance}`)
        break
      case "code":
        if (item.code) lines.push(`- **Code**: ${item.code}`)
        break
      case "dependencies":
        if (item.dependencies) lines.push(`- **Dependencies**: ${item.dependencies}`)
        break
      case "added":
        if (item.added) lines.push(`- **Added**: ${item.added}`)
        break
      case "started":
        if (item.started) lines.push(`- **Started**: ${item.started}`)
        break
      case "completed":
        if (item.completed) lines.push(`- **Completed**: ${item.completed}`)
        break
      case "resolution":
        if (item.resolution) lines.push(`- **Resolution**: ${item.resolution}`)
        break
      case "blocked":
        if (item.blocked) lines.push(`- **Blocked**: ${item.blocked}`)
        break
    }
  }

  return lines.join("\n")
}

export function serializeTodoMarkdown(
  projectName: string,
  sections: TodoSection[]
): string {
  const lines: string[] = [
    "# TODO",
    "",
    `> Project: ${projectName}`,
    "",
    "---",
    "",
  ]

  const sectionOrder: Status[] = ["In Progress", "Ready", "Stuck", "Backlog", "Done"]

  for (const status of sectionOrder) {
    lines.push(`## ${status}`)
    lines.push("")

    const section = sections.find((s) => s.status === status)
    const items = section?.items ?? []

    for (const item of items) {
      lines.push(serializeItem(item))
      lines.push("")
    }

    lines.push("---")
    lines.push("")
  }

  // Remove trailing separator and whitespace
  while (lines.length > 0 && (lines[lines.length - 1] === "" || lines[lines.length - 1] === "---")) {
    lines.pop()
  }
  lines.push("")

  return lines.join("\n")
}

export function serializeDoneItem(item: TodoItem): string {
  return serializeItem(item)
}

export function getTotalItemCount(sections: TodoSection[]): number {
  return sections.reduce((sum, section) => sum + section.items.length, 0)
}

export function getActiveItemCount(sections: TodoSection[]): number {
  return sections
    .filter((s) => s.status !== "Done")
    .reduce((sum, section) => sum + section.items.length, 0)
}
