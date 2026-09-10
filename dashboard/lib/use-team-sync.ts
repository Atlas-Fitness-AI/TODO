"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RealtimeChannel, SupabaseClient, User } from "@supabase/supabase-js"
import { getSyncClient, type ActivityEventRow, type ProfileRow, type ProjectRow, type TaskSnapshotRow } from "./supabase"
import type { ActivityEvent, ParsedProject, SyncConfig, TodoItem } from "./types"

export type SyncStatus = "off" | "signed-out" | "connecting" | "live" | "error"

export interface TeamEvent {
  id: number
  remote: string
  projectName: string
  userId: string
  actor: string
  agent: string
  branch: string | null
  action: string
  title: string
  detail: string
  color: string
  date: string
}

export interface TeammateSnapshot {
  id: number
  userId: string
  actor: string
  avatarUrl: string | null
  remote: string
  branch: string
  tasks: TodoItem[]
  updatedAt: string
}

export interface TeamSync {
  status: SyncStatus
  error: string | null
  user: User | null
  profile: ProfileRow | null
  events: TeamEvent[]
  snapshots: TeammateSnapshot[]
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const EVENT_LIMIT = 200
const LEGACY_AGENT = "dashboard"

function branchKey(item: TodoItem): string {
  return item.branch?.trim() || "main"
}

function snapshotHash(tasks: TodoItem[]): string {
  return JSON.stringify(
    tasks.map((t) => [t.title, t.status, t.priority, t.started ?? "", t.blocked ?? "", t.steps?.map((s) => (s.completed ? 1 : 0)).join("") ?? ""])
  )
}

function activityHash(events: ActivityEvent[]): string {
  return JSON.stringify(events.map((e) => [e.date, e.action, e.title]))
}

/**
 * Mirrors this machine's task state to Supabase and subscribes to the team's.
 * Push-only: nothing ever flows back into local files.
 */
export function useTeamSync(config: SyncConfig | null, projects: ParsedProject[]): TeamSync {
  const client = useMemo(() => (config ? getSyncClient(config) : null), [config])

  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<SyncStatus>(config ? "connecting" : "off")
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Map<string, ProfileRow>>(new Map())
  const [projectRows, setProjectRows] = useState<Map<number, ProjectRow>>(new Map())
  const [eventRows, setEventRows] = useState<ActivityEventRow[]>([])
  const [snapshotRows, setSnapshotRows] = useState<Map<number, TaskSnapshotRow>>(new Map())

  const projectIdByRemote = useRef<Map<string, number>>(new Map())
  const snapshotHashes = useRef<Map<string, string>>(new Map())
  const activityHashes = useRef<Map<string, string>>(new Map())
  const pushing = useRef(false)
  const pushQueued = useRef(false)
  const profilesRef = useRef(profiles)
  profilesRef.current = profiles

  /* ---------------------------------------------------------------- auth */

  useEffect(() => {
    if (!client) return
    let cancelled = false

    client.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setUser(data.session?.user ?? null)
      if (!data.session) setStatus("signed-out")
    })

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session) {
        setStatus("signed-out")
        setEventRows([])
        setSnapshotRows(new Map())
        projectIdByRemote.current.clear()
        snapshotHashes.current.clear()
        activityHashes.current.clear()
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [client])

  const signIn = useCallback(async () => {
    if (!client) return
    setError(null)
    const { error: err } = await client.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (err) setError(err.message)
  }, [client])

  const signOut = useCallback(async () => {
    if (!client) return
    await client.auth.signOut()
  }, [client])

  /* ------------------------------------------------- initial load + realtime */

  const ensureProfile = useCallback(
    async (c: SupabaseClient, userId: string) => {
      if (profilesRef.current.has(userId)) return
      const { data } = await c.from("profiles").select("id, display_name, avatar_url").eq("id", userId).maybeSingle()
      if (data) {
        setProfiles((prev) => {
          const next = new Map(prev)
          next.set(data.id, data as ProfileRow)
          return next
        })
      }
    },
    []
  )

  useEffect(() => {
    if (!client || !user) return
    let cancelled = false
    let channel: RealtimeChannel | null = null
    setStatus("connecting")
    setError(null)

    async function load(c: SupabaseClient) {
      const [profilesRes, projectsRes, eventsRes, snapshotsRes] = await Promise.all([
        c.from("profiles").select("id, display_name, avatar_url"),
        c.from("projects").select("id, remote_url, name, created_by"),
        c
          .from("activity_events")
          .select("id, project_id, user_id, agent, branch, action, title, detail, color, occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(EVENT_LIMIT),
        c.from("task_snapshots").select("id, project_id, user_id, branch, tasks, task_count, updated_at"),
      ])
      const firstError = profilesRes.error ?? projectsRes.error ?? eventsRes.error ?? snapshotsRes.error
      if (firstError) throw new Error(firstError.message)
      if (cancelled) return

      setProfiles(new Map((profilesRes.data as ProfileRow[]).map((p) => [p.id, p])))
      const projMap = new Map<number, ProjectRow>()
      for (const p of projectsRes.data as ProjectRow[]) {
        projMap.set(p.id, p)
        projectIdByRemote.current.set(p.remote_url, p.id)
      }
      setProjectRows(projMap)
      setEventRows(eventsRes.data as ActivityEventRow[])
      setSnapshotRows(new Map((snapshotsRes.data as TaskSnapshotRow[]).map((s) => [s.id, s])))

      channel = c
        .channel("team-sync")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_events" }, (payload) => {
          const row = payload.new as ActivityEventRow
          setEventRows((prev) => (prev.some((e) => e.id === row.id) ? prev : [row, ...prev].slice(0, EVENT_LIMIT)))
          void ensureProfile(c, row.user_id)
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "task_snapshots" }, (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<TaskSnapshotRow>
            if (old.id !== undefined) {
              setSnapshotRows((prev) => {
                const next = new Map(prev)
                next.delete(old.id as number)
                return next
              })
            }
            return
          }
          const row = payload.new as TaskSnapshotRow
          setSnapshotRows((prev) => {
            const next = new Map(prev)
            next.set(row.id, row)
            return next
          })
          void ensureProfile(c, row.user_id)
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "projects" }, (payload) => {
          const row = payload.new as ProjectRow
          projectIdByRemote.current.set(row.remote_url, row.id)
          setProjectRows((prev) => {
            const next = new Map(prev)
            next.set(row.id, row)
            return next
          })
        })
        .subscribe((state, err) => {
          if (cancelled) return
          if (state === "SUBSCRIBED") setStatus("live")
          else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
            setStatus("error")
            setError(err?.message ?? `Realtime ${state.toLowerCase().replace("_", " ")}`)
          }
        })
    }

    load(client).catch((err: Error) => {
      if (cancelled) return
      setStatus("error")
      setError(err.message)
    })

    return () => {
      cancelled = true
      if (channel) void client.removeChannel(channel)
    }
  }, [client, user, ensureProfile])

  /* ----------------------------------------------------------------- push */

  const push = useCallback(
    async (c: SupabaseClient, u: User, list: ParsedProject[]) => {
      for (const project of list) {
        const remote = project.remote
        if (!remote) continue

        let projectId = projectIdByRemote.current.get(remote)
        if (projectId === undefined) {
          const { data: existing } = await c.from("projects").select("id").eq("remote_url", remote).maybeSingle()
          if (existing) {
            projectId = existing.id as number
          } else {
            const { data: created, error: insertErr } = await c
              .from("projects")
              .insert({ remote_url: remote, name: project.name, created_by: u.id })
              .select("id")
              .single()
            if (insertErr) {
              // Lost a race with a teammate registering the same remote.
              const { data: again } = await c.from("projects").select("id").eq("remote_url", remote).maybeSingle()
              if (!again) throw new Error(insertErr.message)
              projectId = again.id as number
            } else {
              projectId = created.id as number
            }
          }
          projectIdByRemote.current.set(remote, projectId)
        }

        // Snapshots: open work grouped by branch. Resolved items stay local.
        const byBranch = new Map<string, TodoItem[]>()
        for (const section of project.sections) {
          if (section.status === "Resolved") continue
          for (const item of section.items) {
            const key = branchKey(item)
            const bucket = byBranch.get(key)
            if (bucket) bucket.push(item)
            else byBranch.set(key, [item])
          }
        }
        if (byBranch.size === 0) byBranch.set("main", [])

        for (const [branch, tasks] of byBranch) {
          const hashKey = `${projectId}|${branch}`
          const hash = snapshotHash(tasks)
          if (snapshotHashes.current.get(hashKey) === hash) continue
          const { error: upsertErr } = await c.from("task_snapshots").upsert(
            {
              project_id: projectId,
              user_id: u.id,
              branch,
              tasks,
              task_count: tasks.length,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "project_id,user_id,branch" }
          )
          if (upsertErr) throw new Error(upsertErr.message)
          snapshotHashes.current.set(hashKey, hash)
        }

        // Drop our own snapshots for branches that no longer have open work.
        const stale = [...snapshotRows.values()].filter(
          (s) => s.project_id === projectId && s.user_id === u.id && !byBranch.has(s.branch)
        )
        if (stale.length > 0) {
          await c.from("task_snapshots").delete().in("id", stale.map((s) => s.id))
          for (const s of stale) snapshotHashes.current.delete(`${projectId}|${s.branch}`)
        }

        // Activity: idempotent on the unique key, so re-pushing the file is safe.
        const events = project.activity ?? []
        const eventsHashKey = String(projectId)
        const eventsHash = activityHash(events)
        if (events.length > 0 && activityHashes.current.get(eventsHashKey) !== eventsHash) {
          const rows = events
            .filter((e) => e.date && !Number.isNaN(Date.parse(e.date)))
            .map((e) => ({
              project_id: projectId,
              user_id: u.id,
              agent: e.agent ?? LEGACY_AGENT,
              branch: null,
              action: e.action,
              title: e.title,
              detail: e.detail ?? null,
              color: e.color ?? null,
              occurred_at: new Date(e.date).toISOString(),
            }))
          const { error: eventsErr } = await c.from("activity_events").upsert(rows, {
            onConflict: "project_id,user_id,occurred_at,action,title",
            ignoreDuplicates: true,
          })
          if (eventsErr) throw new Error(eventsErr.message)
          activityHashes.current.set(eventsHashKey, eventsHash)
        }
      }
    },
    [snapshotRows]
  )

  useEffect(() => {
    if (!client || !user || status !== "live") return
    const c = client
    const u = user

    async function run() {
      if (pushing.current) {
        pushQueued.current = true
        return
      }
      pushing.current = true
      try {
        do {
          pushQueued.current = false
          await push(c, u, projects)
        } while (pushQueued.current)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        pushing.current = false
      }
    }

    void run()
  }, [client, user, status, projects, push])

  /* -------------------------------------------------------------- derived */

  const events = useMemo<TeamEvent[]>(() => {
    return eventRows.map((row) => {
      const project = projectRows.get(row.project_id)
      const profile = profiles.get(row.user_id)
      return {
        id: row.id,
        remote: project?.remote_url ?? "",
        projectName: project?.name ?? "unknown project",
        userId: row.user_id,
        actor: profile?.display_name ?? "teammate",
        agent: row.agent,
        branch: row.branch,
        action: row.action,
        title: row.title,
        detail: row.detail ?? "",
        color: row.color ?? "",
        date: row.occurred_at,
      }
    })
  }, [eventRows, projectRows, profiles])

  const snapshots = useMemo<TeammateSnapshot[]>(() => {
    return [...snapshotRows.values()]
      .filter((row) => row.user_id !== user?.id)
      .map((row) => {
        const project = projectRows.get(row.project_id)
        const profile = profiles.get(row.user_id)
        return {
          id: row.id,
          userId: row.user_id,
          actor: profile?.display_name ?? "teammate",
          avatarUrl: profile?.avatar_url ?? null,
          remote: project?.remote_url ?? "",
          branch: row.branch,
          tasks: Array.isArray(row.tasks) ? row.tasks : [],
          updatedAt: row.updated_at,
        }
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [snapshotRows, projectRows, profiles, user])

  const profile = user ? profiles.get(user.id) ?? null : null

  return { status, error, user, profile, events, snapshots, signIn, signOut }
}
