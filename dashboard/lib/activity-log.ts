import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import type { ActivityEvent } from "./types"

const LOG_FILENAME = ".todo-activity.json"

export async function readActivityLog(projectPath: string): Promise<ActivityEvent[]> {
  const logPath = join(projectPath, LOG_FILENAME)
  try {
    if (!existsSync(logPath)) return []
    const raw = await readFile(logPath, "utf-8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
