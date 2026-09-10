"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { AppSidebar } from "./app-sidebar"
import { StatusOverview } from "./status-overview"
import { TodoCard } from "./todo-card"
import { ThemeToggle } from "./theme-toggle"
import { TaskFilters } from "./task-filters"
import { AddTaskDialog } from "./add-task-dialog"
import { ProjectHero } from "./project-hero"
import { ResolvedHero } from "./resolved-hero"
import { ChangelogDialog } from "./changelog-dialog"
import { isPendingEntry } from "@/lib/changelog"
import { toast } from "sonner"
import { useProjectPolling } from "@/lib/use-project-polling"
import { normalizeActivityColor, DOT_BG, type ActivityItemProps } from "./activity-item"
import { ActivityFeed } from "./activity-feed"
import { TeamMenu } from "./team-menu"
import type { SyncStatus } from "@/lib/sync/server"
import type { ParsedProject, PetKey, Presence, Priority, Status, TodoItem } from "@/lib/types"

const TAB_ORDER: Status[] = ["Active", "Blocked", "Queued", "Pending", "Resolved"]

const TAB_LABELS: Record<Status, string> = {
  Active: "active",
  Blocked: "blocked",
  Queued: "queued",
  Pending: "pending",
  Resolved: "resolved",
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
  defaultBranch?: string | null
  syncStatus?: SyncStatus | null
  defaultCardsCollapsed?: boolean
  version?: string
}

export function Dashboard({ projects: initialProjects, defaultSidebarOpen, defaultProjectIndex, defaultTab, defaultTheme, defaultBranch, syncStatus, defaultCardsCollapsed = true, version }: DashboardProps) {
  const { projects, refresh } = useProjectPolling(initialProjects)
  const router = useRouter()
  const [cardsCollapsed, setCardsCollapsed] = useState(defaultCardsCollapsed)
  function toggleCardsCollapsed() {
    setCardsCollapsed((v) => {
      document.cookie = `cards_collapsed=${!v}; path=/; max-age=${60 * 60 * 24 * 365}`
      return !v
    })
  }
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    defaultProjectIndex !== undefined && defaultProjectIndex !== null && defaultProjectIndex < initialProjects.length
      ? defaultProjectIndex
      : initialProjects.length > 0 ? 0 : null
  )
  const [selectedTab, setSelectedTab] = useState(
    defaultTab && TAB_ORDER.includes(defaultTab as Status) ? defaultTab : "Active"
  )
  const [selectedBranch, setSelectedBranch] = useState<string | null>(defaultBranch ?? null)
  const [searchQuery, setSearchQuery] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<Set<Priority>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set())
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearGroupDialogOpen, setClearGroupDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ActivityItemProps | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1)
  const [mobileActivityOpen, setMobileActivityOpen] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
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
    handleSelectBranch(null)
  }

  function handleSelectBranch(branch: string | null) {
    setSelectedBranch(branch)
    setFocusedCardIndex(-1)
    document.cookie = branch
      ? `selected_branch=${encodeURIComponent(branch)}; path=/; max-age=${60 * 60 * 24 * 7}`
      : "selected_branch=; path=/; max-age=0"
  }

  function handleTabChange(value: string | null) {
    if (!value) return
    setSelectedTab(value)
    setFocusedCardIndex(-1)
    document.cookie = `selected_tab=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 7}`
  }

  const selectedProject =
    selectedIndex !== null ? projects[selectedIndex] : null

  // Distinct branches across the selected project's tasks (unscoped tasks live in "main")
  const projectBranches = useMemo(() => {
    if (!selectedProject) return []
    const branches = new Set<string>()
    for (const section of selectedProject.sections) {
      for (const item of section.items) {
        if (item.branch) branches.add(item.branch)
      }
    }
    return [...branches].sort()
  }, [selectedProject])

  // Guard against stale cookie values pointing at branches that no longer exist
  const effectiveBranch =
    selectedBranch && projectBranches.includes(selectedBranch) ? selectedBranch : null

  // The project viewed through the selected branch directory: "main" = unscoped items
  const scopedProject = useMemo(() => {
    if (!selectedProject) return null
    return {
      ...selectedProject,
      sections: selectedProject.sections.map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          effectiveBranch ? item.branch === effectiveBranch : !item.branch
        ),
      })),
    }
  }, [selectedProject, effectiveBranch])

  const activityEvents = selectedProject?.activity ?? []

  // Who is on an Active task, or who finished a Resolved one, for the pet on its card.
  function workerFor(item: TodoItem): { name: string; pet: PetKey | null; presence: Presence; lastSeen: string | null } | null {
    const team = selectedProject?.team
    if (!team || !item.id) return null
    const userId = item.status === "Resolved" ? team.completedBy[item.id] : team.activeBy[item.id]
    if (!userId) return null
    const member = team.members.find((m) => m.userId === userId)
    return member ? { name: member.name, pet: member.pet, presence: member.presence, lastSeen: member.lastSeen } : null
  }

  useEffect(() => {
    document.title = selectedProject
      ? `TODO | ${selectedProject.name}`
      : "TODO"
  }, [selectedProject])

  const existingTasks = useMemo(() => {
    if (!scopedProject) return []
    return scopedProject.sections
      .filter((s) => s.status !== "Resolved")
      .flatMap((s) => s.items)
  }, [scopedProject])

  // Resolved items in the current branch scope (feeds the changelog dialog)
  const scopedResolvedItems = useMemo(() => {
    if (!scopedProject) return []
    return scopedProject.sections.find((s) => s.status === "Resolved")?.items ?? []
  }, [scopedProject])

  const pendingChangelogCount = useMemo(
    () => scopedResolvedItems.filter(isPendingEntry).length,
    [scopedResolvedItems]
  )

  const resolvedTitles = useMemo(() => {
    if (!scopedProject) return new Set<string>()
    const resolved = scopedProject.sections.find((s) => s.status === "Resolved")
    return new Set((resolved?.items ?? []).map((i) => i.title))
  }, [scopedProject])

  const currentTabItems = useMemo(() => {
    if (!scopedProject) return []
    const section = scopedProject.sections.find((s) => s.status === selectedTab)
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
  }, [scopedProject, selectedTab, searchQuery, priorityFilter, categoryFilter])


  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const tag = target.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return
      // Skip when any dialog is open
      if (helpOpen || clearDialogOpen || clearGroupDialogOpen || selectedEvent || addTaskOpen) return

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

      // c: collapse / expand cards
      if (key === "c" && selectedProject) {
        e.preventDefault()
        toggleCardsCollapsed()
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
  }, [helpOpen, clearDialogOpen, clearGroupDialogOpen, selectedEvent, addTaskOpen, selectedProject, currentTabItems.length])

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} className="!h-svh overflow-hidden">
      <AppSidebar
        projects={projects}
        selectedIndex={selectedIndex}
        onSelect={handleSelect}
        selectedBranch={effectiveBranch}
        onSelectBranch={handleSelectBranch}
        syncSignedIn={syncStatus?.signedIn ?? false}
        teams={syncStatus?.teams ?? []}
        team={syncStatus?.team ?? null}
        onSelectTeam={(t) => {
          document.cookie = `selected_team=${encodeURIComponent(t)}; path=/; max-age=${60 * 60 * 24 * 365}`
          setSelectedIndex(null)
          router.refresh()
        }}
        version={version}
      />
      <SidebarInset>
        {selectedProject ? (
          <Tabs value={selectedTab} onValueChange={handleTabChange} className="!gap-0 flex-1 min-h-0 overflow-hidden">
            <header className="shrink-0">
              {/* border-b inside the fixed height so it aligns with the sidebar header's separator */}
              <div className="flex h-14 md:h-16 items-center gap-2 md:gap-3 px-3 md:px-4 min-w-0 border-b border-border">
                <SidebarToggle />
                <Separator orientation="vertical" className="!h-4 !self-auto" />
                <span className="text-xs md:text-sm font-mono font-medium uppercase tracking-[0.15em] truncate min-w-0 flex-1 md:flex-none">
                  {selectedProject.name}
                </span>
                {projectBranches.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-accent-special border border-accent-special/40 hover:border-accent-special px-1.5 py-0.5 shrink-0 transition-colors"
                          aria-label="Switch branch"
                        />
                      }
                    >
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <circle cx="2" cy="2" r="1.3" stroke="currentColor" strokeWidth="1" />
                        <circle cx="2" cy="7" r="1.3" stroke="currentColor" strokeWidth="1" />
                        <circle cx="7" cy="2" r="1.3" stroke="currentColor" strokeWidth="1" />
                        <path d="M2 3.3v2.4M3.3 2h2.4" stroke="currentColor" strokeWidth="1" />
                      </svg>
                      {effectiveBranch ?? "main"}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={8} className="w-44">
                      <DropdownMenuRadioGroup
                        value={effectiveBranch ?? "__main"}
                        onValueChange={(value) =>
                          handleSelectBranch(value === "__main" ? null : value)
                        }
                      >
                        {["__main", ...projectBranches].map((b) => (
                          <DropdownMenuRadioItem
                            key={b}
                            value={b}
                            className="text-[11px] font-mono uppercase tracking-wider"
                          >
                            {b === "__main" ? "main" : b}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Separator orientation="vertical" className="hidden md:block !h-4 !self-auto" />
                <TabsList variant="line" className="hidden md:inline-flex !bg-transparent !p-0 !h-auto">
                  <StatusOverview sections={scopedProject!.sections} />
                </TabsList>
                <div className="md:ml-auto flex items-center gap-2 md:gap-3 shrink-0">
                  <TaskFilters
                    project={scopedProject!}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    priorityFilter={priorityFilter}
                    onPriorityChange={setPriorityFilter}
                    categoryFilter={categoryFilter}
                    onCategoryChange={setCategoryFilter}
                    searchInputRef={searchInputRef}
                  />
                  <Separator orientation="vertical" className="hidden md:block !h-4 !self-auto" />
                  <button
                    onClick={() => setMobileActivityOpen(true)}
                    className="md:hidden size-7 flex items-center justify-center text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 transition-colors"
                    aria-label="Show activity feed"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                      <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="0.8" />
                    </svg>
                  </button>
                  <button
                    onClick={toggleCardsCollapsed}
                    className={`h-7 flex items-center gap-2 px-2 border-2 transition-colors ${cardsCollapsed ? "text-muted-foreground border-border hover:text-primary hover:border-primary/50" : "text-primary border-primary/50"}`}
                    aria-label={cardsCollapsed ? "Expand cards" : "Collapse cards"}
                    aria-pressed={!cardsCollapsed}
                    title={cardsCollapsed ? "Expand cards (c)" : "Collapse cards (c)"}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      {cardsCollapsed ? (
                        <path d="M1.5 3.5L5 1l3.5 2.5M1.5 6.5L5 9l3.5-2.5" stroke="currentColor" strokeWidth="1.1" />
                      ) : (
                        <path d="M1.5 1L5 3.5 8.5 1M1.5 9L5 6.5 8.5 9" stroke="currentColor" strokeWidth="1.1" />
                      )}
                    </svg>
                    <span className="hidden md:inline text-[10px] uppercase tracking-[0.15em]">
                      {cardsCollapsed ? "expand" : "collapse"}
                    </span>
                  </button>
                  <button
                    onClick={() => setHelpOpen(true)}
                    className="size-7 flex items-center justify-center text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 transition-colors font-mono text-xs"
                    aria-label="Help"
                  >
                    ?
                  </button>
                  <Separator orientation="vertical" className="hidden md:block !h-4 !self-auto" />
                  <TeamMenu status={syncStatus ?? null} />
                  <ThemeToggle defaultTheme={defaultTheme} />
                </div>
              </div>
              <div className="md:hidden border-b border-border px-3 py-2 overflow-x-auto no-scrollbar">
                <TabsList variant="line" className="!bg-transparent !p-0 !h-auto">
                  <StatusOverview sections={scopedProject!.sections} />
                </TabsList>
              </div>
            </header>
            <div className="scanlines flex flex-1 min-h-0 overflow-hidden">
              {/* Cards */}
              <div className="flex-1 min-w-0 h-full md:border-r border-border overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-6 flex flex-col min-h-[calc(100%-1px)]">
                    <div className="relative mb-4">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                        tasks
                      </div>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        <button
                          className="size-7 flex items-center justify-center text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                          aria-label="Clear tasks in current tab"
                          disabled={currentTabItems.length === 0}
                          onClick={() => setClearGroupDialogOpen(true)}
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <rect x="0" y="3" width="8" height="2" fill="currentColor" />
                          </svg>
                        </button>
                        <AddTaskDialog projectPath={selectedProject.path} existingTasks={existingTasks} onAdded={refresh} open={addTaskOpen} onOpenChange={setAddTaskOpen} branch={effectiveBranch} knownBranches={projectBranches} />
                      </div>
                    </div>
                    {TAB_ORDER.map((status) => {
                      const section = scopedProject!.sections.find(
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
                          {status === "Active" && <ProjectHero activeItems={allItems} />}
                          {status === "Resolved" && (
                            <ResolvedHero
                              resolvedItems={allItems}
                              pendingChangelogCount={pendingChangelogCount}
                              onOpenChangelog={() => setChangelogOpen(true)}
                            />
                          )}
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
                                    resolvedTitles={resolvedTitles}
                                    branches={projectBranches}
                                    collapsed={cardsCollapsed}
                                    worker={workerFor(item)}
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
              <div className="hidden md:block w-80 shrink-0 h-full overflow-hidden">
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
                  <ActivityFeed
                    events={activityEvents}
                    members={selectedProject?.team?.members}
                    me={syncStatus?.displayName ?? null}
                    onSelect={(props) => {
                      setMobileActivityOpen(false)
                      setSelectedEvent(props)
                    }}
                  />
                </div>
                </ScrollArea>
              </div>
            </div>
          </Tabs>
        ) : (
          <>
            <header className="flex h-14 md:h-16 items-center gap-2 md:gap-3 border-b px-3 md:px-4">
              <SidebarToggle />
              <Separator orientation="vertical" className="!h-4 !self-auto" />
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground truncate">
                no project selected
              </span>
              <div className="ml-auto flex items-center gap-2 md:gap-3">
                <TeamMenu status={syncStatus ?? null} />
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
                      ? "no projects configured // edit ~/.atlas-todo/config.json"
                      : "select a project from the sidebar"}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </SidebarInset>

      {selectedProject && (
        <ChangelogDialog
          open={changelogOpen}
          onOpenChange={setChangelogOpen}
          projectPath={selectedProject.path}
          branch={effectiveBranch}
          resolvedItems={scopedResolvedItems}
          onChanged={refresh}
        />
      )}

      <Sheet open={mobileActivityOpen} onOpenChange={setMobileActivityOpen}>
        <SheetContent side="right" className="w-[88vw] sm:max-w-sm bg-background p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
              activity feed
            </SheetTitle>
            <SheetDescription className="sr-only">
              Recent task activity for the selected project
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-full">
            <div className="p-4 flex flex-col min-h-[calc(100%-1px)]">
              <ActivityFeed
                    events={activityEvents}
                    members={selectedProject?.team?.members}
                    me={syncStatus?.displayName ?? null}
                    onSelect={(props) => {
                      setMobileActivityOpen(false)
                      setSelectedEvent(props)
                    }}
                    compact
                  />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

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

      <Dialog open={clearGroupDialogOpen} onOpenChange={setClearGroupDialogOpen}>
        <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
              <span className="text-destructive">&gt;</span> Clear {selectedTab} Tasks
            </DialogTitle>
            <DialogDescription>
              This will delete all {currentTabItems.length} task{currentTabItems.length !== 1 ? "s" : ""} in <span className="text-foreground font-medium">{selectedTab}</span>. This cannot be undone.
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
                    body: JSON.stringify({ projectPath: selectedProject.path, clearStatus: selectedTab }),
                  })
                  if (res.ok) {
                    toast.success(`Cleared ${selectedTab} tasks`)
                    refresh()
                  }
                } catch {
                  toast.error("Failed to clear tasks")
                }
                setClearGroupDialogOpen(false)
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
                  <span className={normalizeActivityColor(selectedEvent.color)}>&gt;</span> Event Detail
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Activity event details
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`size-2 rounded-full ${DOT_BG[normalizeActivityColor(selectedEvent.color)] ?? "bg-muted-foreground"}`} />
                  <span className={`text-xs font-mono uppercase tracking-[0.15em] ${normalizeActivityColor(selectedEvent.color)}`}>
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
        <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm sm:!max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
              <span className="text-primary glow-rose">&gt;</span> TODO
            </DialogTitle>
            <DialogDescription className="sr-only">
              Help and reference for the TODO dashboard
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="overview" className="!gap-0 flex flex-col overflow-hidden h-[min(70svh,460px)]">
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
                    what is todo
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    A shared TODO system for <a href="https://docs.anthropic.com/en/docs/claude-code" target="_blank" rel="noopener noreferrer" className="text-primary/80 hover:text-primary underline underline-offset-2">Claude Code</a> and <a href="https://developers.openai.com/codex/skills/" target="_blank" rel="noopener noreferrer" className="text-primary/80 hover:text-primary underline underline-offset-2">Codex</a>. Either agent can pick up the same tasks, with enforced standards for priority, category, file references, context, and acceptance criteria.
                  </p>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-2">
                    statuses
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-status-active" />
                      <span className="text-status-active w-20">ACTIVE</span>
                      <span className="text-muted-foreground/60 flex-1 text-right">Being worked on</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-status-blocked" />
                      <span className="text-status-blocked w-20">BLOCKED</span>
                      <span className="text-muted-foreground/60 flex-1 text-right">Waiting on something</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-status-queued" />
                      <span className="text-status-queued w-20">QUEUED</span>
                      <span className="text-muted-foreground/60 flex-1 text-right">Ready to pick up</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-muted-foreground" />
                      <span className="text-muted-foreground w-20">PENDING</span>
                      <span className="text-muted-foreground/60 flex-1 text-right">Not yet fully defined</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-status-resolved" />
                      <span className="text-status-resolved w-20">RESOLVED</span>
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
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Project list in <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">~/.atlas-todo/config.json</code></li>
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
                    Run <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">/todo init</code> in Claude Code or <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">$todo init</code> in Codex to set up <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">TODO.md</code>, <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">TODORULES.md</code>, and guidance in both CLAUDE.md and AGENTS.md. Existing structured tasks are preserved; unstructured tasks are migrated.
                  </p>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-2">
                    commands
                  </div>
                  <p className="text-muted-foreground/60 mb-3">
                    In Codex, replace <code className="text-primary/80">/todo</code> with <code className="text-primary/80">$todo</code>. All commands use the same task files and activity feed.
                  </p>
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
                    <li><span className="text-muted-foreground/40">&#x2013;</span> <span className="text-status-blocked">Bugs</span> require file references and root cause context</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> <span className="text-status-active">Features</span> require acceptance criteria</li>
                    <li><span className="text-muted-foreground/40">&#x2013;</span> <span className="text-status-queued">Tasks</span> require a description of what and why</li>
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
                    Use the <span className="text-primary">+</span> button to add tasks directly. For enforced documentation standards (file refs, acceptance criteria), use <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">/todo add</code> in Claude Code or <code className="text-primary/80 bg-primary/5 border border-primary/10 px-1">$todo add</code> in Codex.
                  </p>
                </div>

                <Separator className="!bg-border/50" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5">
                    task cards
                  </div>
                  <ul className="space-y-1 text-muted-foreground leading-relaxed">
                    <li><span className="text-muted-foreground/40">&#x2013;</span> Right-click to move between statuses or branches, change priority, or delete</li>
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
                      ["c", "Collapse or expand all cards"],
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
