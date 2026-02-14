"use client"

import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { Priority, Status } from "@/lib/types"

const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"]
const STATUSES: { value: Status; label: string }[] = [
  { value: "Queued", label: "Queued" },
  { value: "Active", label: "Active" },
  { value: "Pending", label: "Pending" },
]

interface AddTaskDialogProps {
  projectPath: string
  onAdded: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddTaskDialog({ projectPath, onAdded, open: controlledOpen, onOpenChange }: AddTaskDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState<Priority>("Medium")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<Status>("Queued")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setTitle("")
    setPriority("Medium")
    setCategory("")
    setDescription("")
    setStatus("Queued")
    setSubmitting(false)
    setError(null)
  }

  async function handleSubmit() {
    if (!title.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPath,
          title: title.trim(),
          priority,
          category: category
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
          description: description.trim() || undefined,
          status,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      setOpen(false)
      reset()
      toast.success("Task added")
      onAdded()
    } catch {
      setError("Failed to add task")
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
            className="size-7 flex items-center justify-center text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 transition-colors"
            aria-label="Add task"
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
            <span className="text-primary glow-rose">&gt;</span> Add Task
          </DialogTitle>
          <DialogDescription>
            Create a new task in this project&apos;s TODO.md.
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
              htmlFor="task-title"
              className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
            >
              Title
            </Label>
            <Input
              id="task-title"
              placeholder="Fix login timeout on refresh"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-mono text-[11px]"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label
                htmlFor="task-priority"
                className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
              >
                Priority
              </Label>
              <Select value={priority} onValueChange={(val) => setPriority(val as Priority)}>
                <SelectTrigger className="w-full font-mono text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="bottom" sideOffset={6} alignItemWithTrigger={false}>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="task-status"
                className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
              >
                Status
              </Label>
              <Select value={status} onValueChange={(val) => setStatus(val as Status)}>
                <SelectTrigger className="w-full font-mono text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="bottom" sideOffset={6} alignItemWithTrigger={false}>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="task-category"
              className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
            >
              Category{" "}
              <span className="normal-case tracking-normal text-muted-foreground/50">
                (comma-separated)
              </span>
            </Label>
            <Input
              id="task-category"
              placeholder="Dashboard, Backend"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="font-mono text-[11px]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="task-description"
              className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
            >
              Description{" "}
              <span className="normal-case tracking-normal text-muted-foreground/50">
                (optional)
              </span>
            </Label>
            <Textarea
              id="task-description"
              placeholder="What needs to happen..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="font-mono text-[11px] min-h-[60px]"
            />
          </div>
          {error && (
            <div className="text-[10px] uppercase tracking-wider text-destructive font-mono">
              <span className="text-destructive">err:</span> {error}
            </div>
          )}
          <DialogFooter>
            <Button
              type="submit"
              disabled={!title.trim() || submitting}
              className="uppercase tracking-[0.15em] font-mono text-[10px]"
            >
              {submitting ? "Adding..." : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
