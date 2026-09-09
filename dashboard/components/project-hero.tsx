import type { TodoItem } from "@/lib/types"

interface ProjectHeroProps {
  activeItems: TodoItem[]
}

export function ProjectHero({ activeItems }: ProjectHeroProps) {
  const allSteps = activeItems.flatMap((i) => i.steps ?? [])
  const totalSteps = allSteps.length
  const completedSteps = allSteps.filter((s) => s.completed).length
  const pct = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100)

  return (
    <div className="mb-6 border border-border/50 bg-card/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-1.5 bg-status-active pulse-dot" />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-status-active">
            &gt; active progress
          </span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">
          {activeItems.length} in flight
        </span>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono font-medium uppercase tracking-wider">
            sub-tasks
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider tabular-nums">
              {completedSteps}/{totalSteps}
            </span>
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider w-9 text-right tabular-nums">
              {pct}%
            </span>
          </div>
        </div>
        <div className="h-1.5 bg-border/30 overflow-hidden">
          <div
            className="h-full bg-primary/60 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
