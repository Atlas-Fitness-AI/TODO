"use client"

export interface ActivityItemProps {
  time: string
  date: string
  action: string
  title: string
  detail: string
  color: string
  onClick?: () => void
}

// Activity events on disk (written by the /todo skill and the API routes) still
// use the original Tailwind color names. Map those to the theme-aware tokens.
export const ACTIVITY_COLOR_ALIASES: Record<string, string> = {
  "text-green-400": "text-status-resolved",
  "text-blue-400": "text-status-active",
  "text-red-400": "text-status-blocked",
  "text-yellow-400": "text-status-queued",
  "text-purple-400": "text-accent-special",
}

export function normalizeActivityColor(color: string): string {
  return ACTIVITY_COLOR_ALIASES[color] ?? color
}

// Static mapping so Tailwind generates these bg classes
export const DOT_BG: Record<string, string> = {
  "text-status-resolved": "bg-status-resolved",
  "text-status-active": "bg-status-active",
  "text-status-blocked": "bg-status-blocked",
  "text-status-queued": "bg-status-queued",
  "text-accent-special": "bg-accent-special",
}

export function ActivityItem({ time, action, title, detail, color: rawColor, onClick }: ActivityItemProps) {
  const color = normalizeActivityColor(rawColor)
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex gap-3 py-3 border-b border-muted-foreground/30 last:border-0 w-full text-left cursor-pointer hover:bg-muted/30 transition-colors"
    >
      <div className="flex flex-col items-center pt-1">
        <div className={`size-1.5 rounded-full ${DOT_BG[color] ?? "bg-muted-foreground"}`} />
        <div className="w-px flex-1 bg-muted-foreground/30 mt-1" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[10px] font-mono uppercase tracking-wider ${color}`}>
            {action}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">
            {time}
          </span>
        </div>
        <p className="text-[11px] font-medium truncate">{title}</p>
        <p className="text-[10px] font-mono text-muted-foreground/60">{detail}</p>
      </div>
    </button>
  )
}
