-- TODO team sync: initial schema
--
-- One Supabase project = one team. Every signed-in user can read everything;
-- users can only write rows they own. Tables are exposed to the Data API for
-- the authenticated role only. Nothing is readable anonymously.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on sign-up
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are visible to the team"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users insert their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Populate a profile when a user signs up. Lives in a private schema so it
-- is not callable through the Data API; it runs as a trigger only.
create schema if not exists private;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- projects: keyed by normalized git remote so every machine agrees
-- ---------------------------------------------------------------------------
create table public.projects (
  id bigint generated always as identity primary key,
  remote_url text not null unique,
  name text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index projects_created_by_idx on public.projects (created_by);

alter table public.projects enable row level security;

create policy "projects are visible to the team"
  on public.projects for select
  to authenticated
  using (true);

create policy "users register projects as themselves"
  on public.projects for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

create policy "project creators update their projects"
  on public.projects for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

create policy "project creators delete their projects"
  on public.projects for delete
  to authenticated
  using ((select auth.uid()) = created_by);

-- ---------------------------------------------------------------------------
-- activity_events: append-only feed mirrored from each machine's
-- .todo-activity.json. The unique key makes re-pushing the same file
-- idempotent.
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  agent text not null default 'dashboard'
    check (agent in ('claude', 'codex', 'dashboard')),
  branch text,
  action text not null,
  title text not null,
  detail text,
  color text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id, occurred_at, action, title)
);

create index activity_events_project_occurred_idx
  on public.activity_events (project_id, occurred_at desc);
create index activity_events_user_id_idx on public.activity_events (user_id);

alter table public.activity_events enable row level security;

create policy "activity is visible to the team"
  on public.activity_events for select
  to authenticated
  using (true);

create policy "users log activity as themselves"
  on public.activity_events for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users delete their own activity"
  on public.activity_events for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- task_snapshots: each user's latest parsed task list per project + branch.
-- Read-only for everyone else; the source of truth stays in TODO.md.
-- ---------------------------------------------------------------------------
create table public.task_snapshots (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  branch text not null default 'main',
  tasks jsonb not null default '[]'::jsonb,
  task_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (project_id, user_id, branch)
);

create index task_snapshots_user_id_idx on public.task_snapshots (user_id);

alter table public.task_snapshots enable row level security;

create policy "snapshots are visible to the team"
  on public.task_snapshots for select
  to authenticated
  using (true);

create policy "users publish their own snapshots"
  on public.task_snapshots for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users update their own snapshots"
  on public.task_snapshots for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users delete their own snapshots"
  on public.task_snapshots for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Data API exposure: authenticated only. Anonymous visitors get nothing.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, delete on public.activity_events to authenticated;
grant select, insert, update, delete on public.task_snapshots to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: dashboards subscribe to these two tables
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.activity_events;
alter publication supabase_realtime add table public.task_snapshots;
