"use client"

import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  isPendingEntry,
  isUnloggedEntry,
  isFixEntry,
  buildReleaseMarkdown,
} from "@/lib/changelog"
import type { TodoItem } from "@/lib/types"

interface ChangelogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectPath: string
  branch: string | null
  resolvedItems: TodoItem[]
  onChanged: () => void
}

// One pending entry row: shows the consumer line, click to edit in place
function EntryRow({
  item,
  onSave,
}: {
  item: TodoItem
  onSave: (title: string, line: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.changelog ?? "")

  async function commit() {
    const line = draft.trim()
    if (!line || line === item.changelog) {
      setEditing(false)
      setDraft(item.changelog ?? "")
      return
    }
    const ok = await onSave(item.title, line)
    if (ok) setEditing(false)
  }

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
      <span
        className={`text-[9px] font-mono uppercase tracking-wider shrink-0 mt-0.5 px-1 border ${
          isFixEntry(item)
            ? "text-status-blocked border-status-blocked/30"
            : "text-status-resolved border-status-resolved/30"
        }`}
      >
        {isFixEntry(item) ? "fix" : "new"}
      </span>
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") {
              setEditing(false)
              setDraft(item.changelog ?? "")
            }
          }}
          onBlur={commit}
          className="font-mono text-[11px] h-6 flex-1"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 text-left text-[11px] font-mono text-foreground/90 hover:text-primary transition-colors"
          title={`From: ${item.title} — click to edit`}
        >
          {item.changelog}
        </button>
      )}
    </div>
  )
}

// A resolved item with no changelog line yet — quick-add input
function UnloggedRow({
  item,
  onSave,
}: {
  item: TodoItem
  onSave: (title: string, line: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  async function commit() {
    const line = draft.trim()
    if (!line || saving) return
    setSaving(true)
    const ok = await onSave(item.title, line)
    setSaving(false)
    if (ok) setDraft("")
  }

  return (
    <div className="py-1.5 border-b border-border/30 last:border-0 space-y-1">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
        {item.title}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
        }}
        placeholder="Write a consumer-facing line and press Enter…"
        className="font-mono text-[11px] h-6"
        disabled={saving}
      />
    </div>
  )
}

export function ChangelogDialog({
  open,
  onOpenChange,
  projectPath,
  branch,
  resolvedItems,
  onChanged,
}: ChangelogDialogProps) {
  const [version, setVersion] = useState("")
  const [releasing, setReleasing] = useState(false)
  const [showUnlogged, setShowUnlogged] = useState(false)

  const pending = useMemo(
    () => resolvedItems.filter(isPendingEntry),
    [resolvedItems]
  )
  const unlogged = useMemo(
    () => resolvedItems.filter(isUnloggedEntry),
    [resolvedItems]
  )

  const today = new Date().toISOString().split("T")[0]
  const previewMarkdown = useMemo(
    () =>
      pending.length > 0
        ? buildReleaseMarkdown(version.trim() || "Unreleased", today, branch, pending)
        : "",
    [pending, version, today, branch]
  )

  async function saveLine(title: string, line: string): Promise<boolean> {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, title, newChangelog: line }),
      })
      if (res.ok) {
        onChanged()
        return true
      }
      const data = await res.json()
      toast.error(data.error || "Failed to save changelog line")
      return false
    } catch {
      toast.error("Failed to save changelog line")
      return false
    }
  }

  function copyMarkdown() {
    navigator.clipboard.writeText(previewMarkdown)
    toast.success("Changelog copied")
  }

  async function cutRelease() {
    const v = version.trim()
    if (!v || releasing) return
    setReleasing(true)
    try {
      const res = await fetch("/api/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, version: v, branch }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Released ${v} — ${data.count} changes → CHANGELOG.md`)
        setVersion("")
        onChanged()
      } else {
        toast.error(data.error || "Failed to cut release")
      }
    } catch {
      toast.error("Failed to cut release")
    } finally {
      setReleasing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm sm:!max-w-xl max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
            <span className="text-primary glow-rose">&gt;</span> Release Notes
            <span className="ml-2 text-accent-special tracking-normal">
              [{branch ?? "main"}]
            </span>
          </DialogTitle>
          <DialogDescription>
            Consumer-facing changes since the last release. Click a line to
            edit it. Cutting a release writes CHANGELOG.md and stamps every
            resolved item in this branch directory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pending entries */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1">
              pending changes [{pending.length}]
            </div>
            {pending.length > 0 ? (
              <div>
                {pending.map((item) => (
                  <EntryRow key={item.title} item={item} onSave={saveLine} />
                ))}
              </div>
            ) : (
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50 border border-dashed border-muted-foreground/30 p-3">
                nothing pending — resolve tasks with changelog lines, or add
                lines to resolved items below
              </div>
            )}
          </div>

          {/* Unlogged resolved items */}
          {unlogged.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowUnlogged((v) => !v)}
                className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showUnlogged ? "▾" : "▸"} resolved without changelog [
                {unlogged.length}]
              </button>
              {showUnlogged && (
                <div className="mt-1">
                  {unlogged.map((item) => (
                    <UnloggedRow key={item.title} item={item} onSave={saveLine} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Markdown preview */}
          {pending.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1">
                markdown preview
              </div>
              <pre className="text-[11px] font-mono text-foreground/80 bg-card/50 border border-border/50 p-3 overflow-x-auto whitespace-pre">
                {previewMarkdown}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v0.3.0"
              className="font-mono text-[11px] h-7 w-28"
              aria-label="Release version"
            />
            <Button
              variant="outline"
              disabled={pending.length === 0}
              onClick={copyMarkdown}
              className="uppercase tracking-[0.15em] font-mono text-[10px] h-7"
            >
              Copy Markdown
            </Button>
            <Button
              disabled={pending.length === 0 || !version.trim() || releasing}
              onClick={cutRelease}
              className="uppercase tracking-[0.15em] font-mono text-[10px] h-7"
            >
              {releasing ? "Releasing…" : "Cut Release"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
