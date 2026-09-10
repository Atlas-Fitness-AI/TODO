import { cookies } from "next/headers"
import { Dashboard } from "@/components/dashboard"
import { loadAllProjects } from "@/lib/projects"
import { getSyncStatus } from "@/lib/sync/server"
import { readActivityLog } from "@/lib/activity-log"

export const dynamic = "force-dynamic"

export default async function Page() {
  const cookieStore = await cookies()
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false"
  const selectedRaw = cookieStore.get("selected_project")?.value
  const defaultProjectIndex = selectedRaw !== undefined ? parseInt(selectedRaw, 10) : null
  const defaultTab = cookieStore.get("selected_tab")?.value
    ? decodeURIComponent(cookieStore.get("selected_tab")!.value)
    : null
  const themeRaw = cookieStore.get("theme")?.value
  const VALID_THEMES = ["light", "dark", "tokyo", "crt", "rose", "synth", "ember", "dawn"]
  const defaultTheme = themeRaw && VALID_THEMES.includes(themeRaw) ? themeRaw : "tokyo"
  const branchRaw = cookieStore.get("selected_branch")?.value
  const defaultBranch = branchRaw ? decodeURIComponent(branchRaw) : null
  const projects = await loadAllProjects()
  const syncStatus = await getSyncStatus()
  for (const project of projects) {
    project.activity = await readActivityLog(project.path)
  }
  return (
    <Dashboard
      projects={projects}
      defaultSidebarOpen={sidebarOpen}
      defaultProjectIndex={Number.isNaN(defaultProjectIndex) ? null : defaultProjectIndex}
      defaultTab={defaultTab}
      defaultTheme={defaultTheme}
      defaultBranch={defaultBranch}
      syncStatus={syncStatus}
    />
  )
}
