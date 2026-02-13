"use client"

import { useState, useMemo } from "react"
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AppSidebar } from "./app-sidebar"
import { StatusOverview } from "./status-overview"
import { TodoCard } from "./todo-card"
import { ThemeToggle } from "./theme-toggle"
import { TaskFilters } from "./task-filters"
import { AddTaskDialog } from "./add-task-dialog"
import { useProjectPolling } from "@/lib/use-project-polling"
import { formatRelativeTime } from "@/lib/activity"
import type { ParsedProject, Priority, Status, TodoItem } from "@/lib/types"

const TAB_ORDER: Status[] = ["In Progress", "Stuck", "Ready", "Backlog", "Done"]

const TAB_LABELS: Record<Status, string> = {
  "In Progress": "active",
  Stuck: "blocked",
  Ready: "ready",
  Backlog: "backlog",
  Done: "done",
}

interface ActivityItemProps {
  time: string
  action: string
  title: string
  detail: string
  color: string
}

// Static mapping so Tailwind generates these bg classes
const DOT_BG: Record<string, string> = {
  "text-green-400": "bg-green-400",
  "text-blue-400": "bg-blue-400",
  "text-red-400": "bg-red-400",
  "text-yellow-400": "bg-yellow-400",
  "text-purple-400": "bg-purple-400",
}

function ActivityItem({ time, action, title, detail, color }: ActivityItemProps) {
  return (
    <div className="flex gap-3 py-3 border-b border-muted-foreground/30 last:border-0">
      <div className="flex flex-col items-center pt-1">
        <div className={`size-1.5 rounded-full ${DOT_BG[color] ?? "bg-muted-foreground"}`} />
        <div className="w-px flex-1 bg-muted-foreground/30 mt-1" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[10px] font-mono uppercase tracking-wider ${color}`}>
            {action}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">
            {time}
          </span>
        </div>
        <p className="text-[11px] font-medium truncate">{title}</p>
        <p className="text-[10px] font-mono text-muted-foreground/60">{detail}</p>
      </div>
    </div>
  )
}

function SidebarToggle() {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      onClick={toggleSidebar}
      className="size-7 flex items-center justify-center text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 transition-colors"
      aria-label="Toggle Sidebar"
    >
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
        <rect x="0" y="0" width="14" height="2" fill="currentColor" />
        <rect x="0" y="4" width="10" height="2" fill="currentColor" />
        <rect x="0" y="8" width="14" height="2" fill="currentColor" />
      </svg>
    </button>
  )
}

interface DashboardProps {
  projects: ParsedProject[]
  defaultSidebarOpen?: boolean
  defaultProjectIndex?: number | null
  defaultTab?: string | null
  defaultTheme?: string
}

export function Dashboard({ projects: initialProjects, defaultSidebarOpen, defaultProjectIndex, defaultTab, defaultTheme }: DashboardProps) {
  const { projects, refresh } = useProjectPolling(initialProjects)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    defaultProjectIndex !== undefined && defaultProjectIndex !== null && defaultProjectIndex < initialProjects.length
      ? defaultProjectIndex
      : initialProjects.length > 0 ? 0 : null
  )
  const [selectedTab, setSelectedTab] = useState(
    defaultTab && TAB_ORDER.includes(defaultTab as Status) ? defaultTab : "In Progress"
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<Set<Priority>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set())
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  function filterItems(items: TodoItem[]): TodoItem[] {
    return items.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = item.title.toLowerCase().includes(q)
        const matchesDesc = item.description?.toLowerCase().includes(q)
        const matchesCat = item.category.some((c) => c.toLowerCase().includes(q))
        if (!matchesTitle && !matchesDesc && !matchesCat) return false
      }
      if (priorityFilter.size > 0 && !priorityFilter.has(item.priority)) return false
      if (categoryFilter.size > 0 && !item.category.some((c) => categoryFilter.has(c))) return false
      return true
    })
  }

  const hasActiveFilters = searchQuery !== "" || priorityFilter.size > 0 || categoryFilter.size > 0

  function handleSelect(index: number) {
    setSelectedIndex(index)
    document.cookie = `selected_project=${index}; path=/; max-age=${60 * 60 * 24 * 7}`
  }

  function handleTabChange(value: string | null) {
    if (!value) return
    setSelectedTab(value)
    document.cookie = `selected_tab=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 7}`
  }

  const selectedProject =
    selectedIndex !== null ? projects[selectedIndex] : null

  const activityEvents = selectedProject?.activity ?? []

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} className="!h-svh overflow-hidden">
      <AppSidebar
        projects={projects}
        selectedIndex={selectedIndex}
        onSelect={handleSelect}
      />
      <SidebarInset>
        {selectedProject ? (
          <Tabs value={selectedTab} onValueChange={handleTabChange} className="!gap-0 flex-1 min-h-0 overflow-hidden">
            <header className="flex shrink-0 h-16 items-center gap-3 border-b px-4">
              <SidebarToggle />
              <Separator orientation="vertical" className="!h-4 !self-auto" />
              <span className="text-sm font-mono font-medium uppercase tracking-[0.15em]">
                {selectedProject.name}
              </span>
              <Separator orientation="vertical" className="!h-4 !self-auto" />
              <TabsList variant="line" className="!bg-transparent !p-0 !h-auto">
                <StatusOverview sections={selectedProject.sections} />
              </TabsList>
              <div className="ml-auto flex items-center gap-3">
                <TaskFilters
                  project={selectedProject}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  priorityFilter={priorityFilter}
                  onPriorityChange={setPriorityFilter}
                  categoryFilter={categoryFilter}
                  onCategoryChange={setCategoryFilter}
                />
                <Separator orientation="vertical" className="!h-4 !self-auto" />
                <ThemeToggle defaultTheme={defaultTheme} />
              </div>
            </header>
            <div className="scanlines flex flex-1 min-h-0 overflow-hidden">
              {/* Cards */}
              <div className="flex-1 min-w-0 h-full border-r border-border overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-6 flex flex-col min-h-[calc(100%-1px)]">
                    <div className="relative mb-4">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                        tasks
                      </div>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2">
                        <AddTaskDialog projectPath={selectedProject.path} onAdded={refresh} />
                      </div>
                    </div>
                    {TAB_ORDER.map((status) => {
                      const section = selectedProject.sections.find(
                        (s) => s.status === status
                      )
                      const allItems = section?.items ?? []
                      const filteredItems = filterItems(allItems)
                      return (
                        <TabsContent
                          key={status}
                          value={status}
                          className={filteredItems.length > 0 ? "" : "flex-1 flex flex-col"}
                        >
                          {filteredItems.length > 0 ? (
                            <div className="grid gap-3">
                              {filteredItems.map((item, index) => (
                                <TodoCard
                                  key={`${item.title}-${index}`}
                                  item={item}
                                  status={status}
                                  projectPath={selectedProject.path}
                                  onMoved={refresh}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-1 items-center justify-center border border-dashed border-muted-foreground/30">
                              <div className="text-center space-y-2">
                                <div className="text-xs font-mono text-primary/60 glow-rose">
                                  {hasActiveFilters ? "> NO MATCHES" : "> EMPTY"}
                                </div>
                                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">
                                  {hasActiveFilters
                                    ? `no items match filters in ${TAB_LABELS[status]}`
                                    : `no items in ${TAB_LABELS[status]}`}
                                </p>
                              </div>
                            </div>
                          )}
                        </TabsContent>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Activity Feed */}
              <div className="w-80 shrink-0 h-full overflow-hidden">
                <ScrollArea className="h-full">
                <div className="p-6 flex flex-col min-h-[calc(100%-1px)]">
                  <div className="relative mb-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                      activity feed
                    </div>
                      <button
                        className="absolute right-0 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        aria-label="Clear activity feed"
                        disabled={activityEvents.length === 0}
                        onClick={() => setClearDialogOpen(true)}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <rect x="0" y="3" width="8" height="2" fill="currentColor" />
                        </svg>
                      </button>
                  </div>
                  {activityEvents.length > 0 ? (
                    <div className="space-y-0">
                      {activityEvents.map((event, i) => (
                        <ActivityItem
                          key={`${event.title}-${event.action}-${i}`}
                          time={formatRelativeTime(event.date)}
                          action={event.action}
                          title={event.title}
                          detail={event.detail}
                          color={event.color}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center border border-dashed border-muted-foreground/30">
                      <div className="text-center space-y-2">
                        <div className="text-xs font-mono text-primary/60 glow-rose">
                          &gt; NO ACTIVITY
                        </div>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">
                          events appear as tasks are added and moved
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                </ScrollArea>
              </div>
            </div>
          </Tabs>
        ) : (
          <>
            <header className="flex h-16 items-center gap-3 border-b px-4">
              <SidebarToggle />
              <Separator orientation="vertical" className="!h-4 !self-auto" />
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">
                no project selected
              </span>
              <div className="ml-auto">
                <ThemeToggle defaultTheme={defaultTheme} />
              </div>
            </header>
            <div className="scanlines flex-1 min-h-0">
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <div className="text-xs font-mono text-primary glow-rose">
                    &gt; AWAITING INPUT
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {projects.length === 0
                      ? "no projects configured // edit ~/.claudedo/config.json"
                      : "select a project from the sidebar"}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </SidebarInset>

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
              <span className="text-destructive">&gt;</span> Clear Activity Feed
            </DialogTitle>
            <DialogDescription>
              This will remove all {activityEvents.length} event{activityEvents.length !== 1 ? "s" : ""} from the activity feed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              className="uppercase tracking-[0.15em] font-mono text-[10px]"
              onClick={async () => {
                if (!selectedProject) return
                try {
                  const res = await fetch("/api/tasks", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ projectPath: selectedProject.path }),
                  })
                  if (res.ok) refresh()
                } catch {
                  // silently fail
                }
                setClearDialogOpen(false)
              }}
            >
              Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
