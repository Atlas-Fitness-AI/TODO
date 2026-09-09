import type { TodoItem } from "./types"

// A resolved item is a pending release-notes entry when it has a
// consumer-facing changelog line and hasn't been included in a release yet.
export function isPendingEntry(item: TodoItem): boolean {
  return Boolean(item.changelog) && !item.released
}

// Resolved items that have neither a changelog line nor a release stamp —
// candidates the user may still want to write a line for.
export function isUnloggedEntry(item: TodoItem): boolean {
  return !item.changelog && !item.released
}

// Heuristic grouping: bug-ish categories (or "Fix…" titles) go under Fixed.
export function isFixEntry(item: TodoItem): boolean {
  return (
    item.category.some((c) => /bug|fix/i.test(c)) || /^fix/i.test(item.title)
  )
}

// Build the markdown section for one release, newest-first convention.
export function buildReleaseMarkdown(
  version: string,
  date: string,
  branch: string | null,
  entries: TodoItem[]
): string {
  const fixes = entries.filter(isFixEntry)
  const news = entries.filter((e) => !isFixEntry(e))

  const lines: string[] = [
    `## ${version} — ${date}${branch ? ` (${branch})` : ""}`,
  ]
  if (news.length > 0) {
    lines.push("", "### New")
    for (const e of news) lines.push(`- ${e.changelog}`)
  }
  if (fixes.length > 0) {
    lines.push("", "### Fixed")
    for (const e of fixes) lines.push(`- ${e.changelog}`)
  }
  return lines.join("\n")
}

// Prepend a release section to CHANGELOG.md content (newest first).
export function prependReleaseSection(
  existing: string | null,
  section: string
): string {
  const HEADER = "# Changelog"
  if (!existing || !existing.trim()) {
    return `${HEADER}\n\n${section}\n`
  }
  const trimmed = existing.replace(/^\uFEFF/, "")
  if (trimmed.trimStart().startsWith(HEADER)) {
    const headerEnd = trimmed.indexOf(HEADER) + HEADER.length
    const rest = trimmed.slice(headerEnd).replace(/^\s*\n/, "")
    return `${HEADER}\n\n${section}\n\n${rest.trimStart()}`
  }
  return `${HEADER}\n\n${section}\n\n${trimmed.trimStart()}`
}

// Escape a string for use inside a RegExp.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Set or replace a single `- **Field**: value` line inside the `### title`
// block of an archive (DONE.md) document, preserving all other formatting.
// Returns the updated content, or null if the title block wasn't found.
export function upsertFieldInDoneMarkdown(
  content: string,
  title: string,
  field: string,
  value: string
): string | null {
  const lines = content.split("\n")
  const headingRe = new RegExp(`^###\\s+${escapeRegExp(title)}\\s*$`)
  const start = lines.findIndex((l) => headingRe.test(l))
  if (start === -1) return null

  // Block ends at the next heading or horizontal rule
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{2,3}\s/.test(lines[i]) || /^---\s*$/.test(lines[i])) {
      end = i
      break
    }
  }

  const fieldRe = new RegExp(`^-\\s+\\*\\*${escapeRegExp(field)}\\*\\*:`)
  const newLine = `- **${field}**: ${value}`

  for (let i = start + 1; i < end; i++) {
    if (fieldRe.test(lines[i])) {
      if (value) lines[i] = newLine
      else lines.splice(i, 1)
      return lines.join("\n")
    }
  }

  if (!value) return content // nothing to remove

  // Insert after the last field/step line in the block
  let insertAt = start + 1
  for (let i = start + 1; i < end; i++) {
    if (/^-\s+\*\*/.test(lines[i]) || /^\s+-\s+\[[ x]\]/.test(lines[i])) {
      insertAt = i + 1
    }
  }
  lines.splice(insertAt, 0, newLine)
  return lines.join("\n")
}
