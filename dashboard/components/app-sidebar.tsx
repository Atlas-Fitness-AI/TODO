"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
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
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
      </Sidebar>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
              <span className="text-destructive">&gt;</span> Remove Project
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remove <span className="text-foreground font-medium">{removeTarget?.name}</span> from
              the dashboard? This won&apos;t delete any files on disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
