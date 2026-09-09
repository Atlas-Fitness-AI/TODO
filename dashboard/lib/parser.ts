import type { TodoItem, TodoSection, Priority, Status, Step } from "./types"

const VALID_STATUSES: Status[] = [
  "Active",
  "Blocked",
  "Queued",
  "Pending",
  "Resolved",
]

const VALID_PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"]

// Map old status names to new canonical names for backwards compatibility
const STATUS_ALIASES: Record<string, Status> = {
  "in progress": "Active",
  "ready": "Queued",
  "stuck": "Blocked",
  "backlog": "Pending",
  "done": "Resolved",
}

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
      const headingLower = heading.toLowerCase()
      // Match against valid statuses — allow trailing text like "(3 items)"
      // Also check old status name aliases for backwards compatibility
      const matchedStatus = VALID_STATUSES.find(
        (s) =>
          s.toLowerCase() === headingLower ||
          headingLower.startsWith(s.toLowerCase())
      ) ?? STATUS_ALIASES[headingLower] ?? null

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

      const steps = fields.steps ? parseSteps(fields.steps) : undefined

      const item: TodoItem = {
        title,
        priority,
        category,
        status,
        ...(fields.branch && { branch: fields.branch }),
        ...(fields.description && { description: fields.description }),
        ...(files && files.length > 0 && { files }),
        ...(fields.context && { context: fields.context }),
        ...(fields.acceptance && { acceptance: fields.acceptance }),
        ...(fields.code && { code: fields.code }),
        ...(fields.dependencies && { dependencies: fields.dependencies }),
        ...(steps && steps.length > 0 && { steps }),
        ...(fields.added && { added: fields.added }),
        ...(fields.started && { started: fields.started }),
        ...(fields.completed && { completed: fields.completed }),
        ...(fields.resolution && { resolution: fields.resolution }),
        ...(fields.blocked && { blocked: fields.blocked }),
        ...(fields.changelog && { changelog: fields.changelog }),
        ...(fields.released && { released: fields.released }),
      }

      items.push(item)
    } catch {
      // Skip malformed items — don't let one bad item kill the section
      continue
    }
  }

  return items
}

function parseSteps(raw: string): Step[] {
  return raw.split("\n").map((line) => {
    const match = line.match(/^-\s+\[([ x])\]\s+(.+)/)
    if (!match) return null
    return { title: match[2].trim(), completed: match[1] === "x" }
  }).filter((s): s is Step => s !== null)
}

function parseFields(lines: string[]): Record<string, string> {
  const fields: Record<string, string> = {}

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^-\s+\*\*([^*]+)\*\*:\s*(.*)/)
    if (match) {
      const key = match[1].trim().toLowerCase()
      const value = match[2].trim()

      if (key === "steps") {
        // Collect subsequent indented checkbox lines
        const stepLines: string[] = []
        while (i + 1 < lines.length) {
          const nextLine = lines[i + 1]
          const stepMatch = nextLine.match(/^\s+-\s+\[([ x])\]\s+(.+)/)
          if (stepMatch) {
            stepLines.push(nextLine.trim())
            i++
          } else {
            break
          }
        }
        if (stepLines.length > 0) {
          fields[key] = stepLines.join("\n")
        }
      } else if (value) {
        fields[key] = value
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

      const steps = fields.steps ? parseSteps(fields.steps) : undefined

      items.push({
        title,
        priority,
        category,
        status: "Resolved",
        ...(fields.branch && { branch: fields.branch }),
        ...(fields.description && { description: fields.description }),
        ...(files && files.length > 0 && { files }),
        ...(fields.context && { context: fields.context }),
        ...(fields.acceptance && { acceptance: fields.acceptance }),
        ...(steps && steps.length > 0 && { steps }),
        ...(fields.added && { added: fields.added }),
        ...(fields.started && { started: fields.started }),
        ...(fields.completed && { completed: fields.completed }),
        ...(fields.resolution && { resolution: fields.resolution }),
        ...(fields.changelog && { changelog: fields.changelog }),
        ...(fields.released && { released: fields.released }),
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
  "branch",
  "files",
  "description",
  "context",
  "acceptance",
  "code",
  "dependencies",
  "steps",
  "added",
  "started",
  "completed",
  "resolution",
  "changelog",
  "released",
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
      case "branch":
        if (item.branch) lines.push(`- **Branch**: ${item.branch}`)
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
      case "steps":
        if (item.steps && item.steps.length > 0) {
          lines.push(`- **Steps**:`)
          for (const step of item.steps) {
            lines.push(`  - [${step.completed ? "x" : " "}] ${step.title}`)
          }
        }
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
      case "changelog":
        if (item.changelog) lines.push(`- **Changelog**: ${item.changelog}`)
        break
      case "released":
        if (item.released) lines.push(`- **Released**: ${item.released}`)
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

  const sectionOrder: Status[] = ["Active", "Queued", "Blocked", "Pending", "Resolved"]

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
    .filter((s) => s.status !== "Resolved")
    .reduce((sum, section) => sum + section.items.length, 0)
}
