import { cookies } from "next/headers"
import { Dashboard } from "@/components/dashboard"
import { loadAllProjects } from "@/lib/projects"

export const dynamic = "force-dynamic"

export default async function Page() {
  const cookieStore = await cookies()
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false"
  const selectedRaw = cookieStore.get("selected_project")?.value
  const defaultProjectIndex = selectedRaw !== undefined ? parseInt(selectedRaw, 10) : null
  const defaultTab = cookieStore.get("selected_tab")?.value
    ? decodeURIComponent(cookieStore.get("selected_tab")!.value)
    : null
  const defaultTheme = cookieStore.get("theme")?.value || "system"
  const projects = await loadAllProjects()
  return (
    <Dashboard
      projects={projects}
      defaultSidebarOpen={sidebarOpen}
      defaultProjectIndex={Number.isNaN(defaultProjectIndex) ? null : defaultProjectIndex}
      defaultTab={defaultTab}
      defaultTheme={defaultTheme}
    />
  )
}
