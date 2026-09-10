"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { SyncConfig, TodoItem } from "./types"

/* Row shapes for the team sync tables (supabase/migrations). */

export interface ProfileRow {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export interface ProjectRow {
  id: number
  remote_url: string
  name: string
  created_by: string
}

export interface ActivityEventRow {
  id: number
  project_id: number
  user_id: string
  agent: "claude" | "codex" | "dashboard"
  branch: string | null
  action: string
  title: string
  detail: string | null
  color: string | null
  occurred_at: string
}

export interface TaskSnapshotRow {
  id: number
  project_id: number
  user_id: string
  branch: string
  tasks: TodoItem[]
  task_count: number
  updated_at: string
}

let cached: { key: string; client: SupabaseClient } | null = null

/** Browser-side client. One instance per URL + key so auth state is shared. */
export function getSyncClient(config: SyncConfig): SupabaseClient {
  const key = `${config.url}|${config.publishableKey}`
  if (cached && cached.key === key) return cached.client
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  cached = { key, client }
  return client
}
