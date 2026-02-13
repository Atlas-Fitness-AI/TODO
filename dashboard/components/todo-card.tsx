"use client"

import type { TodoItem, Priority } from "@/lib/types"
import { CardSpotlight } from "@/components/ui/card-spotlight"

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; borderColor: string }
> = {
  Critical: {
    label: "CRIT",
    color: "text-red-400",
    borderColor: "border-l-red-400",
  },
  High: {
    label: "HIGH",
    color: "text-orange-400",
    borderColor: "border-l-orange-400",
  },
  Medium: {
    label: "MED",
    color: "text-yellow-400",
    borderColor: "border-l-yellow-500",
  },
  Low: {
    label: "LOW",
    color: "text-zinc-500",
    borderColor: "border-l-zinc-600",
  },
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

interface TodoCardProps {
  item: TodoItem
}

export function TodoCard({ item }: TodoCardProps) {
  const priority = PRIORITY_CONFIG[item.priority]
  const hiddenMessage = getStableMessage(item.title)

  return (
    <CardSpotlight
      className={`border border-border/50 border-l-2 ${priority.borderColor} bg-card/50 !p-4 space-y-3 !rounded-none`}
      radius={250}
      color="rgba(255, 100, 50, 0.06)"
      revealContent={
        <div className="absolute inset-0 flex items-start justify-end p-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white mt-[3px] mr-16">
            {hiddenMessage}
          </span>
        </div>
      }
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium">{item.title}</span>
        <span
          className={`text-xs font-mono uppercase tracking-wider shrink-0 ${priority.color}`}
        >
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
      {item.context && (
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
      {item.acceptance && (
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
          <div className="size-1.5 bg-red-400 pulse-dot" />
          <span className="text-xs text-red-400 font-mono">
            {item.blocked}
          </span>
        </div>
      )}

      {/* File references */}
      {item.files && item.files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.files.map((file) => (
            <code
              key={file}
              className="text-[11px] font-mono text-primary/80 bg-primary/5 border border-primary/10 px-2 py-0.5"
            >
              {file}
            </code>
          ))}
        </div>
      )}

      {/* Resolution */}
      {item.resolution && (
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
      {(item.added || item.started || item.completed) && (
        <div className="flex gap-4 text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider pt-2 border-t border-border/30">
          {item.added && <span>added {item.added}</span>}
          {item.started && <span>started {item.started}</span>}
          {item.completed && <span>done {item.completed}</span>}
        </div>
      )}
    </CardSpotlight>
  )
}
