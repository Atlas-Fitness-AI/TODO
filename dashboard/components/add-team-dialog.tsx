"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface AddTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Suggested name when this is the first team. */
  suggestedName?: string
}

/**
 * Register a team: a Supabase project's URL and publishable key under a name.
 * On success the browser goes straight into GitHub sign-in for that team.
 */
export function AddTeamDialog({ open, onOpenChange, suggestedName = "" }: AddTeamDialogProps) {
  const [name, setName] = useState(suggestedName)
  const [url, setUrl] = useState("")
  const [key, setKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), publishableKey: key.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not add team")
      toast.success(`Team "${data.name}" added. Signing in…`)
      window.location.assign(`/api/teams/login?team=${encodeURIComponent(data.name)}`)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  const field = "text-[10px] uppercase tracking-[0.15em] text-muted-foreground"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border/50 bg-background/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase tracking-[0.15em]">
            <span className="text-primary">&gt;</span> Add Team
          </DialogTitle>
          <DialogDescription className="text-[11px] font-mono text-muted-foreground">
            A team is one Supabase project with the Fathom schema. Create the project, push the schema from the repo, enable GitHub sign-in, then paste its details here. The README walks through it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="team-name" className={field}>Name</Label>
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="atlas" className="font-mono text-[11px]" autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="team-url" className={field}>Project URL</Label>
            <Input id="team-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxxxxxx.supabase.co" className="font-mono text-[11px]" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="team-key" className={field}>
              Publishable key{" "}
              <span className="normal-case tracking-normal text-muted-foreground/50">(starts with sb_publishable_; never the secret key)</span>
            </Label>
            <Input id="team-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sb_publishable_…" className="font-mono text-[11px]" />
          </div>
          {error && (
            <div className="text-[10px] uppercase tracking-wider text-destructive font-mono">
              <span className="text-destructive">err:</span> {error}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting || !name.trim() || !url.trim() || !key.trim()} className="uppercase tracking-[0.15em] font-mono text-[10px]">
              {submitting ? "Checking…" : "Add and sign in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
