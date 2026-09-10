"use client"

import { useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AddProjectDialog({ shareOption = false, teams = [], defaultTeam = null }: { shareOption?: boolean; teams?: string[]; defaultTeam?: string | null } = {}) {
  const router = useRouter()
  const triggerId = useId()
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState("")
  const [name, setName] = useState("")
  const [nameManuallySet, setNameManuallySet] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validated, setValidated] = useState(false)
  const [share, setShare] = useState(true)
  const [shareTeam, setShareTeam] = useState<string>(defaultTeam ?? teams[0] ?? "")
  const validateTimer = useRef<ReturnType<typeof setTimeout>>(null)

  function reset() {
    setPath("")
    setName("")
    setNameManuallySet(false)
    setError(null)
    setValidating(false)
    setSubmitting(false)
    setValidated(false)
  }

  async function validatePath(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
      setError(null)
      if (!nameManuallySet) setName("")
      setValidated(false)
      return
    }

    setValidating(true)
    setError(null)
    setValidated(false)

    try {
      const res = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: trimmed }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        if (!nameManuallySet) setName("")
        setValidated(false)
      } else {
        if (!nameManuallySet) setName(data.name || "")
        setValidated(true)
        setError(null)
      }
    } catch {
      setError("Failed to validate path")
    } finally {
      setValidating(false)
    }
  }

  function handlePathChange(value: string) {
    setPath(value)
    setError(null)
    setValidated(false)

    // Debounce validation
    if (validateTimer.current) clearTimeout(validateTimer.current)
    validateTimer.current = setTimeout(() => validatePath(value), 400)
  }

  async function handleSubmit() {
    const trimmed = path.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: trimmed,
          name: name.trim() || undefined,
          ...(shareOption && { share: share ? shareTeam || teams[0] : false }),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      setOpen(false)
      reset()
      router.refresh()
    } catch {
      setError("Failed to add project")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <DialogTrigger
        render={
          <button
            id={triggerId}
            className="size-7 flex items-center justify-center text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 transition-colors"
            aria-label="Add project"
          />
        }
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect x="4" y="0" width="2" height="10" fill="currentColor" />
          <rect x="0" y="4" width="10" height="2" fill="currentColor" />
        </svg>
      </DialogTrigger>
      <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-xs uppercase tracking-[0.15em] font-mono">
            <span className="text-primary glow-rose">&gt;</span> Add Project
          </DialogTitle>
          <DialogDescription>
            Enter the absolute path to a project directory containing a
            TODO.md file.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="grid gap-3"
        >
          <div className="grid gap-1.5">
            <Label
              htmlFor="project-path"
              className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
            >
              Path{" "}
              <span className="normal-case tracking-normal text-muted-foreground/50">
                (run <code className="text-muted-foreground">pwd</code> in terminal to copy)
              </span>
            </Label>
            <Input
              id="project-path"
              placeholder="/Users/you/projects/my-app"
              value={path}
              onChange={(e) => handlePathChange(e.target.value)}
              className="font-mono text-[11px]"
              autoFocus
            />
            {validating && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                validating...
              </div>
            )}
            {validated && !error && (
              <div className="text-[10px] uppercase tracking-wider text-status-resolved font-mono">
                path ok
              </div>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="project-name"
              className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
            >
              Name{" "}
              <span className="normal-case tracking-normal text-muted-foreground/50">
                (optional — auto-derived from TODO.md)
              </span>
            </Label>
            <Input
              id="project-name"
              placeholder="Auto-detected from TODO.md"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameManuallySet(true)
              }}
              className="font-mono text-[11px]"
            />
          </div>
          {shareOption && (
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={share}
                onChange={(e) => setShare(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Share with team{" "}
                {teams.length > 1 && share && (
                  <select
                    value={shareTeam}
                    onChange={(e) => setShareTeam(e.target.value)}
                    onClick={(e) => e.preventDefault()}
                    className="ml-1 bg-background border border-border text-[10px] font-mono uppercase tracking-wider px-1 py-0.5"
                    aria-label="Team"
                  >
                    {teams.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}{" "}
                <span className="block normal-case tracking-normal text-muted-foreground/50">
                  {share
                    ? "Tasks move to the shared database and every teammate sees them."
                    : "Stays local. Change later with sync: true in TODORULES.md."}
                </span>
              </span>
            </label>
          )}
          {error && (
            <div className="text-[10px] uppercase tracking-wider text-destructive font-mono">
              <span className="text-destructive">err:</span> {error}
            </div>
          )}
          <DialogFooter>
            <Button
              type="submit"
              disabled={!path.trim() || submitting}
              className="uppercase tracking-[0.15em] font-mono text-[10px]"
            >
              {submitting ? "Adding..." : "Add Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
