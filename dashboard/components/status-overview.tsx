import { TabsTrigger } from "@/components/ui/tabs"
import type { TodoSection, Status } from "@/lib/types"

const STATUS_CONFIG: Record<
  Status,
  { label: string; color: string; dotColor: string }
> = {
  Active: {
    label: "ACTIVE",
    color: "text-status-active",
    dotColor: "bg-status-active",
  },
  Blocked: {
    label: "BLOCKED",
    color: "text-status-blocked",
    dotColor: "bg-status-blocked",
  },
  Queued: {
    label: "QUEUED",
    color: "text-status-queued",
    dotColor: "bg-status-queued",
  },
  Pending: {
    label: "PENDING",
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
  },
  Resolved: {
    label: "RESOLVED",
    color: "text-status-resolved",
    dotColor: "bg-status-resolved",
  },
}

interface StatusOverviewProps {
  sections: TodoSection[]
}

export function StatusOverview({ sections }: StatusOverviewProps) {
  return (
    <div className="flex gap-3 md:gap-4">
      {sections.map((section) => {
        const config = STATUS_CONFIG[section.status]
        const isActive = section.status === "Active"
        return (
          <TabsTrigger
            key={section.status}
            value={section.status}
            className="!bg-transparent !border-transparent !p-0 !h-auto !rounded-none after:!bg-muted-foreground flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider cursor-pointer shrink-0"
          >
            <div
              className={`size-1.5 ${config.dotColor} ${isActive ? "pulse-dot" : ""}`}
            />
            <span className={config.color}>{config.label}</span>
            <span className="text-muted-foreground">
              {section.items.length}
            </span>
          </TabsTrigger>
        )
      })}
    </div>
  )
}
