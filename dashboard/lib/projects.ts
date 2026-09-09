import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import type { AppConfig, ParsedProject, ProjectConfig } from "./types"
import { parseTodoMarkdown, parseDoneMarkdown } from "./parser"

const CONFIG_PATH = join(homedir(), ".atlas-todo", "config.json")

export async function loadConfig(): Promise<AppConfig> {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return { projects: [] }
    }

    const raw = await readFile(CONFIG_PATH, "utf-8")
    const parsed = JSON.parse(raw)

    // Validate minimal structure
    if (!parsed || !Array.isArray(parsed.projects)) {
      return { projects: [] }
    }

    return parsed as AppConfig
  } catch {
    return { projects: [] }
  }
}

export async function loadProject(
  config: ProjectConfig
): Promise<ParsedProject | null> {
  try {
    const todoPath = join(config.path, "TODO.md")

    if (!existsSync(todoPath)) {
      return null
    }

    const content = await readFile(todoPath, "utf-8")
    const parsed = parseTodoMarkdown(content)

    // Also try to load DONE.md for archived items
    try {
      const donePath = join(config.path, "DONE.md")
      if (existsSync(donePath)) {
        const doneContent = await readFile(donePath, "utf-8")
        const archivedItems = parseDoneMarkdown(doneContent)

        const doneSection = parsed.sections.find((s) => s.status === "Resolved")
        if (doneSection) {
          doneSection.items.push(...archivedItems)
        }
      }
    } catch {
      // DONE.md parse failure shouldn't prevent loading the project
    }

    return {
      name: config.name || parsed.projectName,
      path: config.path,
      sections: parsed.sections,
    }
  } catch {
    // Return null so one broken project doesn't kill the rest
    return null
  }
}

export async function loadAllProjects(): Promise<ParsedProject[]> {
  const config = await loadConfig()
  const projects: ParsedProject[] = []

  for (const projectConfig of config.projects) {
    const project = await loadProject(projectConfig)
    if (project) {
      projects.push(project)
    }
  }

  return projects
}
