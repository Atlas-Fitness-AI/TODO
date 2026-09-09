import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { Priority, TodoItem } from "@/lib/types"

const chartConfig = {
  count: {
    label: "Resolved",
    color: "var(--primary)",
  },
} satisfies ChartConfig

interface ResolvedHeroProps {
  resolvedItems: TodoItem[]
  pendingChangelogCount?: number
  onOpenChangelog?: () => void
}

const PRIORITY_ROWS: { key: Priority; label: string; bar: string; dot: string }[] = [
  { key: "Critical", label: "CRIT", bar: "bg-status-blocked/70", dot: "bg-status-blocked" },
  { key: "High", label: "HIGH", bar: "bg-priority-high/70", dot: "bg-priority-high" },
  { key: "Medium", label: "MED", bar: "bg-status-queued/70", dot: "bg-status-queued" },
  { key: "Low", label: "LOW", bar: "bg-muted-foreground/70", dot: "bg-muted-foreground" },
]

const CHART_DAYS = 30

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000)
}

interface StatProps {
  label: string
  value: string | number
  highlight?: boolean
}

function Stat({ label, value, highlight }: StatProps) {
  return (
    <div
      className={`border p-2.5 md:p-3 ${
        highlight ? "border-foreground/30 bg-card/50" : "border-border/50 bg-card/30"
      }`}
    >
      <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
        {label}
      </div>
      <div
        className="text-2xl md:text-3xl font-mono font-semibold mt-1 tabular-nums leading-none text-foreground"
      >
        {value}
      </div>
    </div>
  )
}

export function ResolvedHero({ resolvedItems, pendingChangelogCount = 0, onOpenChangelog }: ResolvedHeroProps) {
  const total = resolvedItems.length

  if (total === 0) {
    return (
      <div className="mb-6 border border-border/50 bg-card/30 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-1.5 bg-muted-foreground/40" />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            &gt; archive empty
          </span>
        </div>
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/60 leading-relaxed">
          no missions logged yet.
          <br />
          ship your first task to fill the record.
        </p>
      </div>
    )
  }

  const today = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 86400000)
  const monthAgo = new Date(today.getTime() - 30 * 86400000)

  let thisWeek = 0
  let thisMonth = 0
  let completedSteps = 0
  let latestDate: Date | null = null
  let latestTitle: string | null = null
  const priorityCounts: Record<Priority, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  }
  const chart = new Array<number>(CHART_DAYS).fill(0)

  for (const item of resolvedItems) {
    priorityCounts[item.priority]++
    if (item.steps) {
      for (const step of item.steps) {
        if (step.completed) completedSteps++
      }
    }
    if (item.completed) {
      const completedDate = new Date(item.completed)
      if (!isNaN(completedDate.getTime())) {
        if (completedDate >= weekAgo) thisWeek++
        if (completedDate >= monthAgo) thisMonth++
        if (!latestDate || completedDate > latestDate) {
          latestDate = completedDate
          latestTitle = item.title
        }
        const daysAgo = daysBetween(today, completedDate)
        if (daysAgo >= 0 && daysAgo < CHART_DAYS) {
          chart[CHART_DAYS - 1 - daysAgo]++
        }
      }
    }
  }

  const maxDayCount = chart.reduce((m, v) => (v > m ? v : m), 0)

  return (
    <div className="mb-6 border border-border/50 bg-card/30 p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-1.5 bg-foreground/60 pulse-dot shrink-0" />
          <span className="text-[10px] font-mono font-medium uppercase tracking-[0.15em]">
            &gt; mission log
          </span>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          {latestTitle && (
            <span className="hidden sm:block text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50 truncate">
              latest / {latestTitle}
            </span>
          )}
          {onOpenChangelog && (
            <button
              type="button"
              onClick={onOpenChangelog}
              className={`shrink-0 text-[10px] font-mono uppercase tracking-[0.15em] border px-1.5 py-0.5 transition-colors ${
                pendingChangelogCount > 0
                  ? "text-primary border-primary/40 hover:border-primary"
                  : "text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground"
              }`}
            >
              changelog{pendingChangelogCount > 0 ? ` [${pendingChangelogCount}]` : ""}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="resolved" value={total} highlight />
        <Stat label="this week" value={thisWeek} />
        <Stat label="this month" value={thisMonth} />
        <Stat label="steps done" value={completedSteps} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
            priority distribution
          </span>
        </div>
        <div className="flex h-1.5 overflow-hidden border border-border/30">
          {PRIORITY_ROWS.map(
            (p) =>
              priorityCounts[p.key] > 0 && (
                <div
                  key={p.key}
                  className={`h-full ${p.bar} transition-all`}
                  style={{ width: `${(priorityCounts[p.key] / total) * 100}%` }}
                />
              )
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {PRIORITY_ROWS.map((p) => (
            <div key={p.key} className="flex items-center gap-1.5">
              <div className={`size-1.5 ${p.dot}`} />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {p.label}
              </span>
              <span className="text-[10px] font-mono text-foreground tabular-nums">
                {priorityCounts[p.key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {maxDayCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
              activity · 30 days
            </span>
            <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 tabular-nums">
              peak {maxDayCount}
            </span>
          </div>
          <ChartContainer
            config={chartConfig}
            className="h-20 md:h-24 w-full"
          >
            <LineChart
              accessibilityLayer
              data={chart.map((count, i) => ({
                day: i,
                label: i === 0 ? "30d ago" : i === CHART_DAYS - 1 ? "today" : `${CHART_DAYS - 1 - i}d ago`,
                count,
              }))}
              margin={{ top: 6, right: 6, left: 6, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="2 4" className="stroke-border/40" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                interval="preserveStartEnd"
                ticks={[0, CHART_DAYS - 1]}
                tickFormatter={(v) => (v === 0 ? "30D" : "NOW")}
                tick={{ fontSize: 9, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }}
              />
              <YAxis hide domain={[0, Math.max(maxDayCount, 1)]} />
              <ChartTooltip
                cursor={{ stroke: "var(--border)", strokeDasharray: "2 4" }}
                content={
                  <ChartTooltipContent
                    labelKey="label"
                    indicator="line"
                    hideLabel={false}
                  />
                }
              />
              <Line
                dataKey="count"
                type="monotone"
                stroke="var(--color-count)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: "var(--color-count)" }}
              />
            </LineChart>
          </ChartContainer>
        </div>
      )}
    </div>
  )
}
