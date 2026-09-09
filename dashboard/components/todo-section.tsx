"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { TodoCard } from "./todo-card"
import type { TodoSection as TodoSectionType, Status } from "@/lib/types"

const STATUS_DISPLAY: Record<Status, { label: string; color: string }> = {
  Active: { label: "ACTIVE", color: "text-status-active" },
  Blocked: { label: "BLOCKED", color: "text-status-blocked" },
  Queued: { label: "QUEUED", color: "text-status-queued" },
  Pending: { label: "PENDING", color: "text-muted-foreground" },
  Resolved: { label: "RESOLVED", color: "text-muted-foreground/70" },
}

interface TodoSectionProps {
  section: TodoSectionType
  defaultOpen?: boolean
}

export function TodoSection({
  section,
  defaultOpen = true,
}: TodoSectionProps) {
  if (section.items.length === 0) return null

  const display = STATUS_DISPLAY[section.status]

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-3 cursor-pointer group">
        <span className="text-[10px] text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-90">
          &gt;
        </span>
        <span
          className={`text-xs font-mono uppercase tracking-[0.15em] ${display.color}`}
        >
          {display.label}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          [{section.items.length}]
        </span>
        <div className="flex-1 border-t border-border/50 ml-2" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-2 pb-4 pl-4">
          {section.items.map((item, index) => (
            <TodoCard key={`${item.title}-${index}`} item={item} status={section.status} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
