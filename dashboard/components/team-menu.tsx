"use client"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { TeamSync } from "@/lib/use-team-sync"

const STATUS_LABEL: Record<TeamSync["status"], string> = {
  off: "local",
  "signed-out": "sign in",
  connecting: "connecting",
  live: "live",
  error: "sync error",
}

const STATUS_DOT: Record<TeamSync["status"], string> = {
  off: "bg-muted-foreground/40",
  "signed-out": "bg-muted-foreground/60",
  connecting: "bg-status-queued animate-pulse",
  live: "bg-status-resolved",
  error: "bg-status-blocked",
}

function PeopleIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <circle cx="3.5" cy="3" r="1.6" stroke="currentColor" strokeWidth="1" />
      <circle cx="7" cy="3.5" r="1.3" stroke="currentColor" strokeWidth="1" />
      <path d="M0.8 9c0-1.8 1.2-2.8 2.7-2.8S6.2 7.2 6.2 9" stroke="currentColor" strokeWidth="1" />
      <path d="M6.6 8.6c0-1.3.8-2.1 2-2.1s1.4.7 1.4 2.1" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

/**
 * Header control for team sync. Hidden entirely when sync is not configured,
 * so a local-only dashboard looks exactly as it did before.
 */
export function TeamMenu({ sync }: { sync: TeamSync }) {
  if (sync.status === "off") return null

  const label = sync.status === "live" && sync.profile?.display_name ? sync.profile.display_name : STATUS_LABEL[sync.status]

  if (sync.status === "signed-out") {
    return (
      <button
        onClick={() => void sync.signIn()}
        className="h-7 flex items-center gap-2 px-2 text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 transition-colors"
        aria-label="Sign in to team sync"
      >
        <PeopleIcon />
        <span className="hidden md:inline text-[10px] uppercase tracking-[0.15em]">sign in</span>
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className="h-7 flex items-center gap-2 px-2 text-muted-foreground hover:text-primary border-2 border-border hover:border-primary/50 transition-colors"
            aria-label="Team sync"
          />
        }
      >
        <span className={`size-1.5 rounded-full ${STATUS_DOT[sync.status]}`} />
        <span className="hidden md:inline text-[10px] uppercase tracking-[0.15em] max-w-32 truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            team sync
          </DropdownMenuLabel>
          <div className="px-2 pb-2 space-y-1 text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${STATUS_DOT[sync.status]}`} />
              <span className="uppercase tracking-wider">{STATUS_LABEL[sync.status]}</span>
            </div>
            {sync.profile?.display_name && (
              <div className="text-muted-foreground truncate">signed in as {sync.profile.display_name}</div>
            )}
            {sync.error && <div className="text-status-blocked break-words">{sync.error}</div>}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void sync.signOut()}
          className="text-[11px] font-mono uppercase tracking-[0.15em]"
        >
          sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
