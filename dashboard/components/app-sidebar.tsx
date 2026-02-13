"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
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
import { toast } from "sonner"
import type { ParsedProject } from "@/lib/types"
import { getActiveItemCount } from "@/lib/parser"
import { AddProjectDialog } from "@/components/add-project-dialog"

interface AppSidebarProps {
  projects: ParsedProject[]
  selectedIndex: number | null
  onSelect: (index: number) => void
}

export function AppSidebar({
  projects,
  selectedIndex,
  onSelect,
}: AppSidebarProps) {
  const router = useRouter()
  const [removeTarget, setRemoveTarget] = useState<{
    path: string
    name: string
    index: number
  } | null>(null)
  const [renameTarget, setRenameTarget] = useState<{
    path: string
    name: string
  } | null>(null)
  const [renameName, setRenameName] = useState("")
  const [renaming, setRenaming] = useState(false)

  async function handleConfirmRename() {
    if (!renameTarget || !renameName.trim()) return
    setRenaming(true)
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: renameTarget.path, name: renameName.trim() }),
      })
      if (res.ok) {
        router.refresh()
      }
    } catch {
      // silently fail
    } finally {
      setRenaming(false)
      setRenameTarget(null)
    }
  }

  const handleCopyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path)
      toast.success("Path copied to clipboard")
    } catch {
      toast.error("Failed to copy path")
    }
  }, [])

  const handleOpen = useCallback(async (path: string, target: "finder" | "terminal") => {
    try {
      const res = await fetch("/api/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, target }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || `Failed to open in ${target}`)
      }
    } catch {
      toast.error(`Failed to open in ${target}`)
    }
  }, [])

  async function handleConfirmRemove() {
    if (!removeTarget) return
    try {
      const res = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: removeTarget.path }),
      })
      if (res.ok) {
        if (selectedIndex === removeTarget.index) {
          document.cookie = "selected_project=0; path=/; max-age=604800"
        } else if (selectedIndex !== null && removeTarget.index < selectedIndex) {
          document.cookie = `selected_project=${selectedIndex - 1}; path=/; max-age=604800`
        }
        router.refresh()
      }
    } catch {
      // silently fail
    } finally {
      setRemoveTarget(null)
    }
  }

  return (
    <>
      <Sidebar>
        <SidebarHeader className="h-16 justify-center px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-2 bg-primary pulse-dot" />
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary glow-rose">
              ClaudeDo
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            sys // task monitor
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="pt-4">
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                Projects
              </div>
              <AddProjectDialog />
            </div>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {projects.map((project, index) => {
                  const count = getActiveItemCount(project.sections)
                  return (
                    <ContextMenu key={project.path}>
                      <ContextMenuTrigger className="w-full">
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            isActive={selectedIndex === index}
                            onClick={() => onSelect(index)}
                          >
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {String(index).padStart(2, "0")}
                            </span>
                            <span className="uppercase tracking-wider text-xs">
                              {project.name}
                            </span>
                          </SidebarMenuButton>
                          <SidebarMenuBadge
                            className="text-[10px] font-mono text-muted-foreground"
                            style={selectedIndex === index ? { color: "var(--primary)" } : undefined}
                          >
                            [{count}]
                          </SidebarMenuBadge>
                        </SidebarMenuItem>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleCopyPath(project.path)}>
                          Copy path
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleOpen(project.path, "finder")}>
                          Open in Finder
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleOpen(project.path, "terminal")}>
                          Open in Terminal
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            setRenameTarget({ path: project.path, name: project.name })
                            setRenameName(project.name)
                          }}
                        >
                          Rename project
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onClick={() =>
                            setRemoveTarget({
                              path: project.path,
                              name: project.name,
                              index,
                            })
                          }
                        >
                          Remove project
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })}
                {projects.length === 0 && (
                  <div className="px-2 py-4 text-[10px] text-muted-foreground uppercase tracking-wider">
                    <span className="text-primary">&gt;</span> no projects loaded
                    <br />
                    <span className="text-muted-foreground/50 mt-1 block">
                      cfg: ~/.claudedo/config.json
                    </span>
                  </div>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
            <span>version</span>
            <span>0.1.0</span>
          </div>
        </SidebarFooter>
      </Sidebar>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      >
        <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
              <span className="text-primary glow-rose">&gt;</span> Rename Project
            </DialogTitle>
            <DialogDescription>
              Enter a new name for <span className="text-foreground font-medium">{renameTarget?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleConfirmRename()
            }}
          >
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              className="font-mono text-[11px]"
              autoFocus
            />
            <DialogFooter className="mt-4">
              <Button
                type="submit"
                disabled={!renameName.trim() || renaming}
                className="uppercase tracking-[0.15em] font-mono text-[10px]"
              >
                {renaming ? "Saving..." : "Rename"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
              <span className="text-destructive">&gt;</span> Remove Project
            </DialogTitle>
            <DialogDescription>
              Remove <span className="text-foreground font-medium">{removeTarget?.name}</span> from
              the dashboard? This won&apos;t delete any files on disk.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={handleConfirmRemove}
              variant="destructive"
              className="uppercase tracking-[0.15em] font-mono text-[10px]"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
