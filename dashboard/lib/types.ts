export type Priority = "Critical" | "High" | "Medium" | "Low"

export type Status = "In Progress" | "Stuck" | "Ready" | "Backlog" | "Done"

export interface TodoItem {
  title: string
  priority: Priority
  category: string[]
  description?: string
  files?: string[]
  context?: string
  acceptance?: string
  code?: string
  dependencies?: string
  added?: string
  started?: string
  completed?: string
  resolution?: string
  blocked?: string
  status: Status
}

export interface TodoSection {
  status: Status
  items: TodoItem[]
}

export interface ParsedProject {
  name: string
  path: string
  sections: TodoSection[]
  activity?: ActivityEvent[]
}

export interface ActivityEvent {
  date: string
  action: string
  title: string
  detail: string
  color: string
}

export interface ProjectConfig {
  name: string
  path: string
}

export interface AppConfig {
  projects: ProjectConfig[]
}
