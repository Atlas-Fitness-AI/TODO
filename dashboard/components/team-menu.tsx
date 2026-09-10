"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import type { SyncStatus } from "@/lib/sync/server"
import type { PetKey } from "@/lib/types"
import { Pet, PETS, PET_KEYS } from "./pets"

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
 * Header control for team sync: who you are, and which pet stands in for
 * you on the tasks you're working on. Hidden when sync is not configured.
 * Sign-in happens in a terminal (`fathom login`), since the server holds it.
 */
export function TeamMenu({ status }: { status: SyncStatus | null }) {
  const router = useRouter()
  const [saving, setSaving] = useState<PetKey | null>(null)
  if (!status || !status.configured) return null

  const dot = status.signedIn ? "bg-status-resolved" : "bg-status-blocked"
  const label = status.signedIn ? status.displayName ?? "signed in" : "not signed in"
  const current = (status.pet as PetKey | null) ?? null

  async function choose(pet: PetKey) {
    if (saving) return
    setSaving(pet)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pet, team: status?.team ?? undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Could not save")
      }
      toast.success(`${PETS[pet].name} the ${pet} is yours`)
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(null)
    }
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
        {current ? <Pet kind={current} size={14} /> : <span className={`size-1.5 rounded-full ${dot}`} />}
        <span className="hidden md:inline text-[10px] uppercase tracking-[0.15em] max-w-32 truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            team sync{status.team ? ` · ${status.team}` : ""}
          </DropdownMenuLabel>
          <div className="px-2 pb-2 space-y-2 text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${dot}`} />
              <PeopleIcon />
              <span className="uppercase tracking-wider">{label}</span>
            </div>
            {status.signedIn ? (
              <p className="text-muted-foreground">
                Tasks live in the team database. Files refresh every few seconds and your edits push automatically.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Run <code className="text-primary/80">fathom login</code> in a terminal, then reload. Until then this dashboard shows local files only.
              </p>
            )}
          </div>
        </DropdownMenuGroup>
        {status.signedIn && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                your pet
              </DropdownMenuLabel>
              <p className="px-2 pb-2 text-[10px] font-mono text-muted-foreground/70">
                It works alongside you on every task you start, where the whole team can see it.
              </p>
              <div className="grid grid-cols-4 gap-1 px-2 pb-2 max-h-72 overflow-y-auto">
                {PET_KEYS.map((key) => {
                  const selected = current === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void choose(key)}
                      disabled={saving !== null}
                      aria-pressed={selected}
                      title={`${PETS[key].name} the ${key}`}
                      className={`flex flex-col items-center gap-1 p-2 border-2 transition-colors ${
                        selected ? "border-primary/60 bg-primary/5" : "border-transparent hover:border-border"
                      } disabled:opacity-60`}
                    >
                      <Pet kind={key} state={selected ? "work" : "idle"} size={24} />
                      <span className={`text-[9px] font-mono uppercase tracking-wider ${selected ? "text-primary" : "text-muted-foreground"}`}>
                        {PETS[key].name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
