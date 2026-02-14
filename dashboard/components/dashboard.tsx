"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
import { toast } from "sonner"
import { useProjectPolling } from "@/lib/use-project-polling"
import { formatRelativeTime } from "@/lib/activity"
import type { ParsedProject, Priority, Status, TodoItem } from "@/lib/types"

const TAB_ORDER: Status[] = ["Active", "Blocked", "Queued", "Pending", "Resolved"]

const TAB_LABELS: Record<Status, string> = {
  Active: "active",
  Blocked: "blocked",
  Queued: "queued",
  Pending: "pending",
  Resolved: "resolved",
}

interface ActivityItemProps {
  time: string
  date: string
  action: string
  title: string
  detail: string
  color: string
  onClick?: () => void
}

// Static mapping so Tailwind generates these bg classes
const DOT_BG: Record<string, string> = {
  "text-green-400": "bg-green-400",
  "text-blue-400": "bg-blue-400",
  "text-red-400": "bg-red-400",
  "text-yellow-400": "bg-yellow-400",
  "text-purple-400": "bg-purple-400",
}

function ActivityItem({ time, action, title, detail, color, onClick }: ActivityItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex gap-3 py-3 border-b border-muted-foreground/30 last:border-0 w-full text-left cursor-pointer hover:bg-muted/30 transition-colors"
    >
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
    </button>
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
    defaultTab && TAB_ORDER.includes(defaultTab as Status) ? defaultTab : "Active"
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<Set<Priority>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set())
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ActivityItemProps | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)

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
    setFocusedCardIndex(-1)
    document.cookie = `selected_project=${index}; path=/; max-age=${60 * 60 * 24 * 7}`
  }

  function handleTabChange(value: string | null) {
    if (!value) return
    setSelectedTab(value)
    setFocusedCardIndex(-1)
    document.cookie = `selected_tab=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 7}`
  }

  const selectedProject =
    selectedIndex !== null ? projects[selectedIndex] : null

  const activityEvents = selectedProject?.activity ?? []

  const currentTabItems = useMemo(() => {
    if (!selectedProject) return []
    const section = selectedProject.sections.find((s) => s.status === selectedTab)
    const items = section?.items ?? []
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
  }, [selectedProject, selectedTab, searchQuery, priorityFilter, categoryFilter])


  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const tag = target.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return
      // Skip when any dialog is open
      if (helpOpen || clearDialogOpen || selectedEvent || addTaskOpen) return

      const key = e.key

      // 1-5: switch tabs
      if (key >= "1" && key <= "5") {
        const idx = parseInt(key) - 1
        if (idx < TAB_ORDER.length) {
          handleTabChange(TAB_ORDER[idx])
        }
        return
      }

      // j/k: navigate cards
      if (key === "j") {
        setFocusedCardIndex((prev) => Math.min(prev + 1, currentTabItems.length - 1))
        return
      }
      if (key === "k") {
        setFocusedCardIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      // n: open add task dialog
      if (key === "n" && selectedProject) {
        e.preventDefault()
        setAddTaskOpen(true)
        return
      }

      // /: focus search
      if (key === "/") {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // ?: open help
      if (key === "?") {
        setHelpOpen(true)
        return
      }

      // Escape: clear focused card
      if (key === "Escape") {
        setFocusedCardIndex(-1)
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [helpOpen, clearDialogOpen, selectedEvent, addTaskOpen, selectedProject, currentTabItems.length])

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
                  searchInputRef={searchInputRef}
                />
                <Separator orientation="vertical" className="!h-4 !self-auto" />
                <button
                  onClick={() => setHelpOpen(true)}
                  className="size-7 flex items-center justify-center text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 transition-colors font-mono text-xs"
                  aria-label="Help"
                >
                  ?
                </button>
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
                        <AddTaskDialog projectPath={selectedProject.path} onAdded={refresh} open={addTaskOpen} onOpenChange={setAddTaskOpen} />
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
                                <div
                                  key={`${item.title}-${index}`}
                                  ref={(el) => {
                                    if (focusedCardIndex === index && status === selectedTab && el) {
                                      el.scrollIntoView({ block: "nearest", behavior: "smooth" })
                                    }
                                  }}
                                >
                                  <TodoCard
                                    item={item}
                                    status={status}
                                    projectPath={selectedProject.path}
                                    onMoved={refresh}
                                    focused={focusedCardIndex === index && status === selectedTab}
                                  />
                                </div>
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
                      {activityEvents.map((event, i) => {
                        const props: ActivityItemProps = {
                          time: formatRelativeTime(event.date),
                          date: event.date,
                          action: event.action,
                          title: event.title,
                          detail: event.detail,
                          color: event.color,
                        }
                        return (
                          <ActivityItem
                            key={`${event.title}-${event.action}-${i}`}
                            {...props}
                            onClick={() => setSelectedEvent(props)}
                          />
                        )
                      })}
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

      <Dialog open={selectedEvent !== null} onOpenChange={(open) => { if (!open) setSelectedEvent(null) }}>
        <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
                  <span className={selectedEvent.color}>&gt;</span> Event Detail
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Activity event details
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`size-2 rounded-full ${DOT_BG[selectedEvent.color] ?? "bg-muted-foreground"}`} />
                  <span className={`text-xs font-mono uppercase tracking-[0.15em] ${selectedEvent.color}`}>
                    {selectedEvent.action}
                  </span>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60 mb-1">
                    task
                  </div>
                  <p className="text-sm font-mono font-medium">{selectedEvent.title}</p>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60 mb-1">
                    detail
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{selectedEvent.detail}</p>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60 mb-1">
                    timestamp
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">
                    {new Date(selectedEvent.date).toLocaleString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{selectedEvent.time}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
              <span className="text-primary glow-rose">&gt;</span> ClaudeDo
            </DialogTitle>
            <DialogDescription className="sr-only">
              Help and reference for the ClaudeDo dashboard
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="overview" className="!gap-0 flex flex-col overflow-hidden h-[460px]">
            <TabsList variant="line" className="!bg-transparent !p-0 !h-auto !rounded-none border-b border-border/50 pb-2 mb-4 w-full">
              {["overview", "skill", "dashboard", "keys"].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="!bg-transparent !border-transparent !p-0 !h-auto !rounded-none after:!bg-muted-foreground text-[10px] font-mono uppercase tracking-[0.15em] cursor-pointer flex-1 text-center"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="text-xs font-mono min-h-0 overflow-hidden [&[hidden]]:!hidden">
              <ScrollArea className="h-full pr-3">
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    what is claudedo
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    A structured TODO system for <a href="https://docs.anthropic.com/en/docs/claude-code" target="_blank" rel="noopener noreferrer" className="text-primary/80 hover:text-primary underline underline-offset-2">Claude Code</a> that turns Claude into a project task manager. Every task gets documented with enforced standards — priority, category, file references, context, and acceptance criteria.
                  </p>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-2">
                    statuses
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-blue-400" />
                      <span className="text-blue-400 w-20">ACTIVE</span>
                      <span className="text-muted-foreground/60 flex-1 text-right">Being worked on</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-red-400" />
                      <span className="text-red-400 w-20">BLOCKED</span>
                      <span className="text-muted-foreground/60 flex-1 text-right">Waiting on something</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-yellow-400" />
                      <span className="text-yellow-400 w-20">QUEUED</span>
                      <span className="text-muted-foreground/60 flex-1 text-right">Ready to pick up</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-zinc-500" />
                      <span className="text-zinc-500 w-20">PENDING</span>
                      <span className="text-muted-foreground/60 flex-1 text-right">Not yet fully defined</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-green-400" />
                      <span className="text-green-400 w-20">RESOLVED</span>
                      <span className="text-muted-foreground/60 flex-1 text-right">Completed and archived</span>
                    </div>
                  </div>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-2">
                    status flow
                  </div>
                  <pre className="text-xs text-muted-foreground leading-relaxed">{`Pending → Queued → Active → Resolved
              ↕        ↕
           Blocked ←───┘
              │
              └──→ Queued`}</pre>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    storage
                  </div>
                  <ul className="space-y-1 text-muted-foreground leading-relaxed">
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Tasks live in each project&apos;s <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">TODO.md</code></li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Completed items archive to <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">DONE.md</code></li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Rules and categories in <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">TODORULES.md</code></li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Project list in <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">~/.claudedo/config.json</code></li>
                  </ul>
                </div>
              </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="skill" className="text-xs font-mono min-h-0 overflow-hidden [&[hidden]]:!hidden">
              <ScrollArea className="h-full pr-3">
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    getting started
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Run <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">/todo init</code> in any project to create <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">TODO.md</code>, <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">TODORULES.md</code>, and a <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">CLAUDE.md</code> section. If a TODO.md already exists, init migrates it to the structured format.
                  </p>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-2">
                    commands
                  </div>
                  <div className="grid gap-2 text-muted-foreground">
                    {[
                      ["/todo", "Status overview"],
                      ["/todo add [desc]", "Add a new item"],
                      ["/todo done [item]", "Mark completed and archive"],
                      ["/todo move [item] [status]", "Move to any status"],
                      ["/todo start [item]", "Start with full briefing"],
                      ["/todo next", "Pick highest-priority queued item"],
                      ["/todo stuck [item]", "Mark as blocked"],
                      ["/todo scan", "Find inline TODO/FIXME comments"],
                      ["/todo dashboard", "Launch this dashboard"],
                      ["/todo update", "Refresh templates"],
                    ].map(([cmd, desc]) => (
                      <div key={cmd} className="flex gap-2">
                        <code
                          className="text-primary/80 shrink-0 w-[200px] cursor-pointer hover:text-primary transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText(cmd)
                            toast.success(`Copied ${cmd}`)
                          }}
                        >{cmd}</code>
                        <span className="text-muted-foreground/60 flex-1 text-right">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    documentation standards
                  </div>
                  <ul className="space-y-1 text-muted-foreground leading-relaxed">
                    <li><span className="text-muted-foreground/40">&#x2013;</span> <span className="text-red-400">Bugs</span> require file references and root cause context</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> <span className="text-blue-400">Features</span> require acceptance criteria</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> <span className="text-yellow-400">Tasks</span> require a description of what and why</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> All items get priority, category, and imperative-mood titles</li>
                  </ul>
                </div>
              </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="dashboard" className="text-xs font-mono min-h-0 overflow-hidden [&[hidden]]:!hidden">
              <ScrollArea className="h-full pr-3">
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    adding tasks
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Use the <span className="text-primary">+</span> button to add tasks directly. For enforced documentation standards (file refs, acceptance criteria), use <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">/todo add</code> in Claude Code instead.
                  </p>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    task cards
                  </div>
                  <ul className="space-y-1 text-muted-foreground leading-relaxed">
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Right-click to move between statuses, change priority, or delete</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Left border color indicates the current status</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Hover cards for a hidden message</li>
                  </ul>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    sidebar
                  </div>
                  <ul className="space-y-1 text-muted-foreground leading-relaxed">
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Add projects with the <span className="text-primary">+</span> button — enter any path with a TODO.md</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Right-click projects to rename, remove, copy path, or open in Finder/Terminal</li>
                  </ul>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    activity feed
                  </div>
                  <ul className="space-y-1 text-muted-foreground leading-relaxed">
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Shows task movements from both the skill and dashboard actions</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Click any event to see full details</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Clear with the <span className="text-muted-foreground">&#x2014;</span> button (irreversible)</li>
                  </ul>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    other
                  </div>
                  <ul className="space-y-1 text-muted-foreground leading-relaxed">
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Auto-refreshes every 3s when TODO.md changes externally</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Search and filter tasks by keyword, priority, or category</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Theme, tab, sidebar, and project selection persist across reloads</li>
                  </ul>
                </div>
              </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="keys" className="text-xs font-mono min-h-0 overflow-hidden [&[hidden]]:!hidden">
              <ScrollArea className="h-full pr-3">
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    navigation
                  </div>
                  <div className="grid gap-2 text-muted-foreground">
                    {[
                      ["1 – 5", "Switch between status tabs"],
                      ["J", "Next card"],
                      ["K", "Previous card"],
                      ["Esc", "Clear card focus"],
                    ].map(([key, desc]) => (
                      <div key={key} className="flex gap-2 items-center">
                        <kbd className="shrink-0 min-w-[48px] text-center text-[10px] px-1.5 py-0.5 border border-border bg-muted/50 text-primary/80">{key}</kbd>
                        <span className="text-muted-foreground/60 flex-1 text-right">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    actions
                  </div>
                  <div className="grid gap-2 text-muted-foreground">
                    {[
                      ["N", "Open add task dialog"],
                      ["/", "Focus search input"],
                      ["?", "Open this help modal"],
                    ].map(([key, desc]) => (
                      <div key={key} className="flex gap-2 items-center">
                        <kbd className="shrink-0 min-w-[48px] text-center text-[10px] px-1.5 py-0.5 border border-border bg-muted/50 text-primary/80">{key}</kbd>
                        <span className="text-muted-foreground/60 flex-1 text-right">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    notes
                  </div>
                  <ul className="space-y-1 text-muted-foreground leading-relaxed">
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Shortcuts are disabled while typing in inputs or when a dialog is open</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Right-click a focused card to access the context menu</li>
                  </ul>
                </div>
              </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
