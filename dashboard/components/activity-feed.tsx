"use client"

import { useMemo, useState, type CSSProperties } from "react"
import { formatRelativeTime } from "@/lib/activity"
import type { ActivityEvent, TeamMember } from "@/lib/types"
import { normalizeActivityColor, DOT_BG, type ActivityItemProps } from "./activity-item"
import { Pet } from "./pets"

/*
 * The activity feed. Consecutive events on the same task fold into one row,
 * days are divided, the actor's pet is the timeline marker, long text is
 * clamped (the event dialog shows it all), and a mine/team filter appears
 * once there is a team to filter.
 */

/** Events on the same task closer together than this fold into one row. */
const BURST_WINDOW_MS = 30 * 60_000

type Filter = "all" | "mine" | "team"

interface Group {
  key: string
  latest: ActivityEvent
  rest: ActivityEvent[]
}

interface ActivityFeedProps {
  events: ActivityEvent[]
  members?: TeamMember[]
  /** Display name of the signed-in user, for the "mine" filter. */
  me?: string | null
  onSelect: (event: ActivityItemProps) => void
  compact?: boolean
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (diffDays === 0) return "today"
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" })
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function groupBursts(events: ActivityEvent[]): Group[] {
  const groups: Group[] = []
  for (const event of events) {
    const last = groups[groups.length - 1]
    if (last && last.latest.title === event.title) {
      const gap = Date.parse(last.latest.date) - Date.parse(event.date)
      const tail = last.rest[last.rest.length - 1] ?? last.latest
      const gapFromTail = Date.parse(tail.date) - Date.parse(event.date)
      if (!Number.isNaN(gap) && gapFromTail >= 0 && gapFromTail < BURST_WINDOW_MS) {
        last.rest.push(event)
        continue
      }
    }
    groups.push({ key: `${event.date}|${event.action}|${event.title}`, latest: event, rest: [] })
  }
  return groups
}

function toProps(event: ActivityEvent): ActivityItemProps {
  return {
    time: formatRelativeTime(event.date),
    date: event.date,
    action: event.action,
    title: event.title,
    detail: event.actor ? `${event.actor} · ${event.detail}` : event.detail,
    color: event.color,
  }
}

function Marker({ event, member, color }: { event: ActivityEvent; member?: TeamMember; color: string }) {
  if (member?.pet) {
    // Tint the sprite with the action color by overriding its foreground token.
    const style = { "--foreground": "currentColor" } as CSSProperties
    return (
      <span className={`flex h-4 w-4 items-center justify-center ${color}`} style={style} title={member.name}>
        <Pet kind={member.pet} size={14} title={`${member.name}`} />
      </span>
    )
  }
  return (
    <span className="flex h-4 w-4 items-center justify-center" title={event.actor ?? undefined}>
      <span className={`size-1.5 rounded-full ${DOT_BG[color] ?? "bg-muted-foreground"}`} />
    </span>
  )
}

function Row({
  group,
  member,
  onSelect,
  compact,
}: {
  group: Group
  member?: TeamMember
  onSelect: (event: ActivityItemProps) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const { latest, rest } = group
  const color = normalizeActivityColor(latest.color)
  const count = rest.length + 1
  const who = latest.actor && !member ? latest.actor : null

  return (
    <div className="flex gap-3 py-3 border-b border-muted-foreground/20 last:border-0">
      <div className="flex flex-col items-center pt-0.5">
        <Marker event={latest} member={member} color={color} />
        <div className="w-px flex-1 bg-muted-foreground/20 mt-1" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <button type="button" onClick={() => onSelect(toProps(latest))} className="w-full text-left cursor-pointer group">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-[10px] font-mono uppercase tracking-wider ${color}`}>
              {latest.action}
              {count > 1 && (
                <span className="ml-1.5 text-muted-foreground/60 normal-case tracking-normal">×{count}</span>
              )}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">{formatRelativeTime(latest.date)}</span>
          </div>
          <p className={`text-[11px] font-medium leading-snug group-hover:text-primary transition-colors ${compact ? "line-clamp-2" : "line-clamp-2"}`}>
            {latest.title}
          </p>
          {(latest.detail || who) && (
            <p className="text-[10px] font-mono text-muted-foreground/60 line-clamp-2">
              {who ? `${who} · ` : ""}
              {latest.detail}
            </p>
          )}
        </button>
        {count > 1 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            aria-expanded={open}
          >
            {open ? "hide" : `${rest.length} earlier`}
          </button>
        )}
        {open && (
          <ul className="space-y-1 border-l border-muted-foreground/20 pl-2">
            {rest.map((e, i) => {
              const c = normalizeActivityColor(e.color)
              return (
                <li key={`${e.date}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(toProps(e))}
                    className="flex w-full items-baseline justify-between gap-2 text-left cursor-pointer hover:text-primary transition-colors"
                  >
                    <span className={`text-[9px] font-mono uppercase tracking-wider ${c}`}>{e.action}</span>
                    <span className="flex-1 truncate text-[10px] font-mono text-muted-foreground/60">{e.detail}</span>
                    <span className="text-[9px] font-mono text-muted-foreground/40 shrink-0">{formatRelativeTime(e.date)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export function ActivityFeed({ events, members = [], me = null, onSelect, compact = false }: ActivityFeedProps) {
  const [filter, setFilter] = useState<Filter>("all")
  const memberByName = useMemo(() => new Map(members.map((m) => [m.name, m])), [members])
  const showFilter = members.length > 1 && me !== null

  const filtered = useMemo(() => {
    if (filter === "all" || !me) return events
    return events.filter((e) => (filter === "mine" ? e.actor === me : e.actor !== undefined && e.actor !== me))
  }, [events, filter, me])

  const sections = useMemo(() => {
    const groups = groupBursts(filtered)
    const out: { label: string; groups: Group[] }[] = []
    for (const g of groups) {
      const label = dayLabel(g.latest.date)
      const last = out[out.length - 1]
      if (last && last.label === label) last.groups.push(g)
      else out.push({ label, groups: [g] })
    }
    return out
  }, [filtered])

  return (
    <div className="flex flex-col min-h-full">
      {showFilter && (
        <div className="mb-3 flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.15em]" role="tablist" aria-label="Activity filter">
          {(["all", "mine", "team"] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`transition-colors ${filter === f ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
            >
              {f}
            </button>
          ))}
        </div>
      )}
      {sections.length === 0 ? (
        <div className="flex flex-1 items-center justify-center border border-dashed border-muted-foreground/30">
          <div className="text-center space-y-2 px-4">
            <div className="text-xs font-mono text-primary/60 glow-rose">&gt; NO ACTIVITY</div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">
              {filter === "all" ? "events appear as tasks are added and moved" : "nothing here for this filter"}
            </p>
          </div>
        </div>
      ) : (
        <div>
          {sections.map((section) => (
            <div key={section.label}>
              <div className="sticky top-0 z-10 -mx-1 px-1 py-1 bg-background/90 backdrop-blur-sm text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40">
                {section.label}
              </div>
              {section.groups.map((g) => (
                <Row
                  key={g.key}
                  group={g}
                  member={g.latest.actor ? memberByName.get(g.latest.actor) : undefined}
                  onSelect={onSelect}
                  compact={compact}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
