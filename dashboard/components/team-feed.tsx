"use client"

import { useMemo } from "react"
import { ActivityItem, type ActivityItemProps } from "./activity-item"
import { formatRelativeTime } from "@/lib/activity"
import type { TeamSync, TeammateSnapshot } from "@/lib/use-team-sync"
import type { TodoItem } from "@/lib/types"

interface TeamFeedProps {
  sync: TeamSync
  /** Normalized git remote of the selected project; undefined when it has none. */
  remote: string | undefined
  /** Selected branch directory, or null for main. */
  branch: string | null
  onSelectEvent: (event: ActivityItemProps) => void
}

const STATUS_ORDER: Record<string, number> = { Active: 0, Blocked: 1, Queued: 2, Pending: 3 }
const STATUS_COLOR: Record<string, string> = {
  Active: "text-status-active",
  Blocked: "text-status-blocked",
  Queued: "text-status-queued",
  Pending: "text-muted-foreground",
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-1 items-center justify-center border border-dashed border-muted-foreground/30">
      <div className="text-center space-y-2 px-4">
        <div className="text-xs font-mono text-primary/60 glow-rose">&gt; {title}</div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">{hint}</p>
      </div>
    </div>
  )
}

function TeammateCard({ snapshot }: { snapshot: TeammateSnapshot }) {
  const visible = useMemo(() => {
    const sorted = [...snapshot.tasks].sort(
      (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
    )
    return sorted.slice(0, 5)
  }, [snapshot.tasks])
  const hidden = snapshot.tasks.length - visible.length

  return (
    <div className="border border-border/60 p-3 space-y-2">
      <div className="flex items-center gap-2 min-w-0">
        {snapshot.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={snapshot.avatarUrl} alt="" className="size-4 shrink-0" />
        ) : (
          <span className="size-4 shrink-0 border border-muted-foreground/40" />
        )}
        <span className="text-[11px] font-mono font-medium truncate">{snapshot.actor}</span>
        <span className="text-[10px] font-mono text-accent-special uppercase tracking-wider shrink-0">
          {snapshot.branch}
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/40 shrink-0">
          {formatRelativeTime(snapshot.updatedAt)}
        </span>
      </div>
      {visible.length === 0 ? (
        <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">no open work</p>
      ) : (
        <ul className="space-y-1">
          {visible.map((task: TodoItem) => (
            <li key={task.title} className="flex items-baseline gap-2 min-w-0">
              <span className={`text-[9px] font-mono uppercase tracking-wider shrink-0 ${STATUS_COLOR[task.status] ?? ""}`}>
                {task.status}
              </span>
              <span className="text-[11px] truncate">{task.title}</span>
            </li>
          ))}
          {hidden > 0 && (
            <li className="text-[10px] font-mono text-muted-foreground/50">+{hidden} more</li>
          )}
        </ul>
      )}
    </div>
  )
}

export function TeamFeed({ sync, remote, branch, onSelectEvent }: TeamFeedProps) {
  const snapshots = useMemo(
    () => sync.snapshots.filter((s) => s.remote === remote && (branch ? s.branch === branch : true)),
    [sync.snapshots, remote, branch]
  )
  const events = useMemo(() => sync.events.filter((e) => e.remote === remote), [sync.events, remote])

  if (sync.status === "signed-out") {
    return (
      <div className="flex flex-1 items-center justify-center border border-dashed border-muted-foreground/30">
        <div className="text-center space-y-3 px-4">
          <div className="text-xs font-mono text-primary/60 glow-rose">&gt; NOT SIGNED IN</div>
          <button
            onClick={() => void sync.signIn()}
            className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 px-3 py-1 transition-colors"
          >
            sign in with github
          </button>
        </div>
      </div>
    )
  }

  if (sync.status === "error") {
    return <Empty title="SYNC ERROR" hint={sync.error ?? "could not reach supabase"} />
  }

  if (sync.status === "connecting") {
    return <Empty title="CONNECTING" hint="loading team state" />
  }

  if (!remote) {
    return <Empty title="NO REMOTE" hint="team sync needs a git origin remote" />
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">teammates</div>
        {snapshots.length === 0 ? (
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50 border border-dashed border-muted-foreground/30 p-3">
            nobody else has synced this project yet
          </p>
        ) : (
          <div className="space-y-2">
            {snapshots.map((s) => (
              <TeammateCard key={s.id} snapshot={s} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">team activity</div>
        {events.length === 0 ? (
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50 border border-dashed border-muted-foreground/30 p-3">
            no team events for this project
          </p>
        ) : (
          <div className="space-y-0">
            {events.map((event) => {
              const who = `${event.actor} via ${event.agent}`
              const props: ActivityItemProps = {
                time: formatRelativeTime(event.date),
                date: event.date,
                action: event.action,
                title: event.title,
                detail: event.detail ? `${who} · ${event.detail}` : who,
                color: event.color,
              }
              return <ActivityItem key={event.id} {...props} onClick={() => onSelectEvent(props)} />
            })}
          </div>
        )}
      </div>
    </div>
  )
}
