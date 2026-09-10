"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { ParsedProject } from "./types"

const POLL_INTERVAL = 3000

export function useProjectPolling(initialProjects: ParsedProject[]): {
  projects: ParsedProject[]
  refresh: () => Promise<void>
} {
  const [projects, setProjects] = useState(initialProjects)
  const prevHash = useRef("")

  // Compute a lightweight hash to detect changes
  const computeHash = useCallback((data: ParsedProject[]) => {
    return JSON.stringify(
      data.map((p) => ({
        name: p.name,
        path: p.path,
        sections: p.sections.map((s) => ({
          status: s.status,
          items: s.items.map((i) => i.title + i.status + i.priority + (i.steps?.map((s) => s.completed ? "1" : "0").join("") ?? "")),
        })),
        activityCount: p.activity?.length ?? 0,
        latestActivity: p.activity?.[0]?.date ?? "",
        // Team presence: pets and who is on which task must count as change too.
        team: p.team
          ? p.team.members.map((m) => `${m.userId}:${m.pet ?? ""}:${m.presence}`).join(",") +
            "|" +
            Object.entries(p.team.activeBy).map(([t, u]) => `${t}=${u}`).sort().join(",")
          : "",
        syncError: p.syncError ?? "",
      }))
    )
  }, [])

  // Initialize hash from initial data
  useEffect(() => {
    prevHash.current = computeHash(initialProjects)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update when server re-renders with new initial data (e.g. after router.refresh)
  useEffect(() => {
    const hash = computeHash(initialProjects)
    if (hash !== prevHash.current) {
      prevHash.current = hash
      setProjects(initialProjects)
    }
  }, [initialProjects, computeHash])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    async function poll() {
      // Skip if tab is hidden
      if (document.hidden) {
        timeoutId = setTimeout(poll, POLL_INTERVAL)
        return
      }

      try {
        const res = await fetch("/api/projects")
        if (res.ok) {
          const data: ParsedProject[] = await res.json()
          const hash = computeHash(data)
          if (hash !== prevHash.current) {
            prevHash.current = hash
            setProjects(data)
          }
        }
      } catch {
        // Silently ignore fetch errors — will retry next interval
      }

      timeoutId = setTimeout(poll, POLL_INTERVAL)
    }

    timeoutId = setTimeout(poll, POLL_INTERVAL)

    return () => clearTimeout(timeoutId)
  }, [computeHash])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/projects")
      if (res.ok) {
        const data: ParsedProject[] = await res.json()
        prevHash.current = computeHash(data)
        setProjects(data)
      }
    } catch {
      // Silently ignore — will retry on next poll
    }
  }, [computeHash])

  return { projects, refresh }
}
