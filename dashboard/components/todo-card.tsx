"use client"

import { useState } from "react"
import type { TodoItem, Priority, Status, PetKey, Presence } from "@/lib/types"
import { Pet, petName } from "./pets"
import { formatRelativeTime } from "@/lib/activity"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu"
import { CardSpotlight } from "@/components/ui/card-spotlight"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string }
> = {
  Critical: {
    label: "CRIT",
    color: "text-status-blocked",
  },
  High: {
    label: "HIGH",
    color: "text-priority-high",
  },
  Medium: {
    label: "MED",
    color: "text-status-queued",
  },
  Low: {
    label: "LOW",
    color: "text-muted-foreground",
  },
}

const STATUS_BORDER_COLOR: Record<Status, string> = {
  Active: "var(--status-active)",
  Blocked: "var(--status-blocked)",
  Queued: "var(--status-queued)",
  Pending: "var(--muted-foreground)",
  Resolved: "var(--status-resolved)",
}

const HIDDEN_MESSAGES = [
  "GET BACK TO WORK",
  "SHIP IT ALREADY",
  "NO BREAKS ALLOWED",
  "STOP HOVERING, START CODING",
  "THIS WON'T FIX ITSELF",
  "DISCIPLINE IS FREEDOM",
  "CLOSE TWITTER",
  "TRUST THE PROCESS",
  "YOU'RE ALMOST THERE",
  "COFFEE WON'T WRITE THIS",
]

function getStableMessage(title: string) {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0
  }
  return HIDDEN_MESSAGES[Math.abs(hash) % HIDDEN_MESSAGES.length]
}

const ALL_STATUSES: Status[] = ["Active", "Blocked", "Queued", "Pending", "Resolved"]
const ALL_PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"]

const STATUS_LABELS: Record<Status, string> = {
  Active: "Active",
  Blocked: "Blocked",
  Queued: "Queued",
  Pending: "Pending",
  Resolved: "Resolved",
}

interface TodoCardProps {
  item: TodoItem
  status: Status
  projectPath?: string
  onMoved?: () => void
  focused?: boolean
  resolvedTitles?: Set<string>
  /** Known branch names in this project (for the "Move to branch" submenu) */
  branches?: string[]
  /** Hide the long-form fields until the card is clicked. */
  collapsed?: boolean
  /** Whoever moved this task into Active, with their pet (team sync). */
  worker?: { name: string; pet: PetKey | null; presence: Presence; lastSeen: string | null } | null
}

export function TodoCard({ item, status, projectPath, onMoved, focused, resolvedTitles, branches = [], collapsed = false, worker = null }: TodoCardProps) {
  const priority = PRIORITY_CONFIG[item.priority]
  // A collapsed card can be opened on its own. The override remembers which
  // global state it was made under, so flipping the header toggle resets it.
  const [override, setOverride] = useState<{ under: boolean; expanded: boolean } | null>(null)
  const expanded = override?.under === collapsed ? override.expanded : false
  const setExpanded = (next: boolean) => setOverride({ under: collapsed, expanded: next })
  const hasDetails = Boolean(
    item.context || item.acceptance || item.files?.length || item.dependencies || item.resolution
  )
  const collapsible = collapsed && hasDetails
  const showDetails = !collapsed || expanded
  const hiddenMessage = getStableMessage(item.title)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [stepsExpanded, setStepsExpanded] = useState(false)
  const [branchDialogOpen, setBranchDialogOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState("")
  const [branchSubmitting, setBranchSubmitting] = useState(false)

  async function handleDelete() {
    if (!projectPath) return
    try {
      const res = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, title: item.title }),
      })
      if (res.ok) {
        toast.success("Task deleted")
        onMoved?.()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete task")
      }
    } catch {
      toast.error("Failed to delete task")
    }
  }

  async function handleMove(newStatus: Status) {
    if (!projectPath) return
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath,
          title: item.title,
          newStatus,
        }),
      })
      if (res.ok) {
        toast.success(`Moved to ${STATUS_LABELS[newStatus]}`)
        onMoved?.()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to move task")
      }
    } catch {
      toast.error("Failed to move task")
    }
  }

  async function handleToggleStep(stepIndex: number) {
    if (!projectPath) return
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath,
          title: item.title,
          toggleStep: stepIndex,
        }),
      })
      if (res.ok) {
        onMoved?.()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to toggle step")
      }
    } catch {
      toast.error("Failed to toggle step")
    }
  }

  // Move the task to another branch directory. null = unscoped ("main").
  async function handleBranch(newBranch: string | null): Promise<boolean> {
    if (!projectPath) return false
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath,
          title: item.title,
          newBranch,
        }),
      })
      if (res.ok) {
        toast.success(`Moved to ${newBranch ?? "main"}`)
        onMoved?.()
        return true
      }
      const data = await res.json()
      toast.error(data.error || "Failed to move task")
      return false
    } catch {
      toast.error("Failed to move task")
      return false
    }
  }

  async function handleNewBranchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = newBranchName.trim()
    if (!name || branchSubmitting) return
    setBranchSubmitting(true)
    const ok = await handleBranch(name)
    setBranchSubmitting(false)
    if (ok) {
      setBranchDialogOpen(false)
      setNewBranchName("")
    }
  }

  async function handlePriority(newPriority: Priority) {
    if (!projectPath) return
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath,
          title: item.title,
          newPriority,
        }),
      })
      if (res.ok) {
        toast.success(`Priority set to ${newPriority}`)
        onMoved?.()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update priority")
      }
    } catch {
      toast.error("Failed to update priority")
    }
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <CardSpotlight
          className={`border border-l-2 bg-card/50 !p-4 !rounded-none ${focused ? "border-primary/60 ring-1 ring-primary/30" : "border-border/50"}`}
          style={{ borderLeftColor: STATUS_BORDER_COLOR[status] }}
          radius={250}
          color="rgba(255, 100, 50, 0.06)"
          revealContent={
            <div className="absolute inset-0 flex items-start justify-end p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-black dark:text-white mt-[3px] mr-16">
                {hiddenMessage}
              </span>
            </div>
          }
        >
          <div
            className={`relative z-10 space-y-3 ${collapsible ? "cursor-pointer" : ""}`}
            onClick={() => {
              if (collapsible) setExpanded(!expanded)
            }}
          >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-mono font-medium uppercase tracking-wide">{item.title}</span>
          <span className={`text-xs font-mono uppercase tracking-wider shrink-0 ${priority.color}`}>
            [{priority.label}]
          </span>
        </div>

        {/* Category tags */}
        {item.category.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.category.map((cat) => (
              <span
                key={cat}
                className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground border border-border/50 px-2 py-0.5"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {item.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Context */}
        {showDetails && item.context && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
              context
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              {item.context}
            </p>
          </div>
        )}

        {/* Acceptance */}
        {showDetails && item.acceptance && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
              acceptance
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              {item.acceptance}
            </p>
          </div>
        )}

        {/* Blocked */}
        {item.blocked && (
          <div className="flex items-center gap-1.5">
            <div className="size-1.5 bg-status-blocked pulse-dot" />
            <span className="text-xs text-status-blocked font-mono">
              {item.blocked}
            </span>
          </div>
        )}

        {/* File references */}
        {showDetails && item.files && item.files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.files.map((file, i) => (
              <code
                key={`${file}-${i}`}
                className="text-[11px] font-mono text-primary/80 bg-primary/5 border border-primary/10 px-2 py-0.5 break-all max-w-full"
              >
                {file}
              </code>
            ))}
          </div>
        )}

        {/* Dependencies */}
        {showDetails && item.dependencies && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
              depends on
            </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {item.dependencies.split(",").map((dep) => dep.trim()).filter(Boolean).map((dep, i) => {
                const isResolved = resolvedTitles?.has(dep) ?? false
                return (
                  <code
                    key={`${dep}-${i}`}
                    className={`text-[11px] font-mono px-2 py-0.5 ${
                      isResolved
                        ? "text-status-resolved/80 bg-status-resolved/5 border border-status-resolved/10"
                        : "text-status-queued/80 bg-status-queued/5 border border-status-queued/10"
                    }`}
                  >
                    {isResolved ? "✓" : "⧖"} {dep}
                  </code>
                )
              })}
            </div>
          </div>
        )}

        {/* Steps */}
        {item.steps && item.steps.length > 0 && (() => {
          const completed = item.steps.filter((s) => s.completed).length
          const total = item.steps.length
          const pct = Math.round((completed / total) * 100)
          return (
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setStepsExpanded(!stepsExpanded)
                }}
                className="flex items-center gap-2 w-full group"
              >
                <div className="flex-1 h-1.5 bg-border/30 overflow-hidden">
                  <div
                    className="h-full bg-primary/60 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 shrink-0">
                  steps {completed}/{total}
                </span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className={`text-muted-foreground/40 transition-transform ${stepsExpanded ? "rotate-180" : ""}`}
                >
                  <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              {stepsExpanded && (
                <div className="flex flex-wrap gap-2 py-2 mt-1">
                  {item.steps.map((step, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleStep(i)
                      }}
                      className={`flex items-center gap-1.5 border px-2 py-1 transition-colors hover:border-primary/30 ${
                        step.completed
                          ? "border-status-resolved/20 bg-status-resolved/5"
                          : "border-border/50 bg-card/30"
                      }`}
                    >
                      <span
                        className={`size-3 shrink-0 border flex items-center justify-center ${
                          step.completed
                            ? "border-status-resolved/50 bg-status-resolved/20"
                            : "border-border"
                        }`}
                      >
                        {step.completed && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.5" className="text-status-resolved" />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`text-[11px] font-mono text-left ${
                          step.completed
                            ? "line-through text-muted-foreground/40"
                            : "text-foreground/80"
                        }`}
                      >
                        {step.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Resolution */}
        {showDetails && item.resolution && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
              resolution
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              {item.resolution}
            </p>
          </div>
        )}

        {/* Dates */}
        {(item.added || item.started || item.completed || item.author || (worker?.pet && status === "Active")) && (
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider pt-2 border-t border-border/30">
            {item.author && <span className="text-accent-special/80">by {item.author}</span>}
            {item.added && <span>added {item.added}</span>}
            {item.started && <span>started {item.started}</span>}
            {item.completed && <span>done {item.completed}</span>}
            {item.released && (
              <span className="text-status-resolved/80">▲ {item.released}</span>
            )}
            {worker?.pet && status === "Active" && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto flex items-center gap-2 text-primary/70 hover:text-primary transition-colors cursor-pointer"
                      aria-label={`${petName(worker.pet)} belongs to ${worker.name}`}
                    />
                  }
                >
                  <span className="normal-case tracking-normal">
                    {petName(worker.pet)} {worker.presence === "away" ? "is on it, but away" : "is on it"}
                  </span>
                  <Pet kind={worker.pet} state={worker.presence === "away" ? "away" : "work"} size={20} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="w-60" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-3 px-2 py-2">
                    <div className="flex h-10 w-10 shrink-0 items-end justify-center">
                      <Pet kind={worker.pet} state={worker.presence === "away" ? "away" : "work"} size={32} />
                    </div>
                    <div className="min-w-0 leading-tight font-mono">
                      <div className="text-[11px] font-medium uppercase tracking-wider truncate">
                        {petName(worker.pet)} the {worker.pet}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">belongs to {worker.name}</div>
                      <div className={`text-[9px] uppercase tracking-[0.15em] mt-1 ${worker.presence === "away" ? "text-status-queued/80" : "text-primary"}`}>
                        {worker.presence}
                        {worker.lastSeen && ` · seen ${formatRelativeTime(worker.lastSeen)}`}
                      </div>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
        </CardSpotlight>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            navigator.clipboard.writeText(item.title)
            toast.success("Copied to clipboard")
          }}
        >
          Copy task name
        </ContextMenuItem>
        {projectPath && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {ALL_STATUSES.filter((s) => s !== status).map((s) => (
                  <ContextMenuItem key={s} onClick={() => handleMove(s)}>
                    {STATUS_LABELS[s]}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Move to branch</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {item.branch && (
                  <ContextMenuItem onClick={() => handleBranch(null)}>
                    main
                  </ContextMenuItem>
                )}
                {branches
                  .filter((b) => b !== item.branch)
                  .map((b) => (
                    <ContextMenuItem key={b} onClick={() => handleBranch(b)}>
                      {b}
                    </ContextMenuItem>
                  ))}
                {(item.branch || branches.some((b) => b !== item.branch)) && (
                  <ContextMenuSeparator />
                )}
                <ContextMenuItem
                  onClick={() => {
                    setNewBranchName("")
                    setBranchDialogOpen(true)
                  }}
                >
                  New branch…
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Set priority</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {ALL_PRIORITIES.filter((p) => p !== item.priority).map((p) => (
                  <ContextMenuItem key={p} onClick={() => handlePriority(p)}>
                    <span className={PRIORITY_CONFIG[p].color}>[{PRIORITY_CONFIG[p].label}]</span>
                    <span className="ml-1">{p}</span>
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete task
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>

      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm">
          <form onSubmit={handleNewBranchSubmit}>
            <DialogHeader>
              <DialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
                <span className="text-accent-special">&gt;</span> Move to Branch
              </DialogTitle>
              <DialogDescription>
                Scope <span className="text-foreground font-medium">{item.title}</span> to a new branch.
                Currently on <span className="text-foreground font-medium">{item.branch ?? "main"}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5 py-4">
              <Label
                htmlFor={`branch-name-${item.title}`}
                className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
              >
                Branch
              </Label>
              <Input
                id={`branch-name-${item.title}`}
                autoFocus
                placeholder="training-beta"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="font-mono text-[11px]"
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={!newBranchName.trim() || branchSubmitting}
                className="uppercase tracking-[0.15em] font-mono text-[10px]"
              >
                {branchSubmitting ? "Moving…" : "Move"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
              <span className="text-destructive">&gt;</span> Delete Task
            </DialogTitle>
            <DialogDescription>
              Permanently delete <span className="text-foreground font-medium">{item.title}</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              className="uppercase tracking-[0.15em] font-mono text-[10px]"
              onClick={() => {
                handleDelete()
                setDeleteDialogOpen(false)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContextMenu>
  )
}
