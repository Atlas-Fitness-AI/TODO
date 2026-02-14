import { TabsTrigger } from "@/components/ui/tabs"
import type { TodoSection, Status } from "@/lib/types"

const STATUS_CONFIG: Record<
  Status,
  { label: string; color: string; dotColor: string }
> = {
  Active: {
    label: "ACTIVE",
    color: "text-blue-400",
    dotColor: "bg-blue-400",
  },
  Blocked: {
    label: "BLOCKED",
    color: "text-red-400",
    dotColor: "bg-red-400",
  },
  Queued: {
    label: "QUEUED",
    color: "text-yellow-400",
    dotColor: "bg-yellow-400",
  },
  Pending: {
    label: "PENDING",
    color: "text-zinc-500",
    dotColor: "bg-zinc-500",
  },
  Resolved: {
    label: "RESOLVED",
    color: "text-green-400",
    dotColor: "bg-green-400",
  },
}

interface StatusOverviewProps {
  sections: TodoSection[]
}

export function StatusOverview({ sections }: StatusOverviewProps) {
  return (
    <div className="flex flex-wrap gap-4">
      {sections.map((section) => {
        const config = STATUS_CONFIG[section.status]
        const isActive = section.status === "Active"
        return (
          <TabsTrigger
            key={section.status}
            value={section.status}
            className="!bg-transparent !border-transparent !p-0 !h-auto !rounded-none after:!bg-muted-foreground flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider cursor-pointer"
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
