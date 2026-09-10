"use client"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import type { SyncStatus } from "@/lib/sync/server"

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
 * Header indicator for team sync. Hidden when sync is not configured, so a
 * local-only dashboard looks exactly as it did before. Sign-in happens in a
 * terminal (`todo login`) because the dashboard server holds the session.
 */
export function TeamMenu({ status }: { status: SyncStatus | null }) {
  if (!status || !status.configured) return null

  const dot = status.signedIn ? "bg-status-resolved" : "bg-status-blocked"
  const label = status.signedIn ? status.displayName ?? "signed in" : "not signed in"

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
        <span className={`size-1.5 rounded-full ${dot}`} />
        <span className="hidden md:inline text-[10px] uppercase tracking-[0.15em] max-w-32 truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            team sync
          </DropdownMenuLabel>
          <div className="px-2 pb-2 space-y-2 text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <PeopleIcon />
              <span className="uppercase tracking-wider">{label}</span>
            </div>
            {status.signedIn ? (
              <p className="text-muted-foreground">
                Tasks live in the team database. Files refresh every few seconds and your edits push automatically.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Run <code className="text-primary/80">todo login</code> in a terminal, then reload. Until then this dashboard shows local files only.
              </p>
            )}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
