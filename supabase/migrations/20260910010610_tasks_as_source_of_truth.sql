-- v2: tasks live in the database. TODO.md / DONE.md become local caches that
-- the `todo sync` command materializes and pushes. Team-wide read and write.

create table public.tasks (
  id text primary key,
  project_id bigint not null references public.projects (id) on delete cascade,
  branch text,
  status text not null check (status in ('Active', 'Blocked', 'Queued', 'Pending', 'Resolved')),
  priority text not null default 'Medium' check (priority in ('Critical', 'High', 'Medium', 'Low')),
  title text not null,
  category text[] not null default '{}',
  description text,
  files text[],
  context text,
  acceptance text,
  code text,
  dependencies text,
  steps jsonb not null default '[]'::jsonb,
  added text,
  started text,
  completed text,
  resolution text,
  blocked text,
  changelog text,
  released text,
  -- true when the item lives in the archive file (DONE.md) rather than TODO.md
  archived boolean not null default false,
  -- order within its status section, as written in the file
  position integer not null default 0,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_project_archived_status_idx on public.tasks (project_id, archived, status);
create index tasks_created_by_idx on public.tasks (created_by);
create index tasks_updated_by_idx on public.tasks (updated_by);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

alter table public.tasks enable row level security;

create policy "tasks are visible to the team"
  on public.tasks for select
  to authenticated
  using (true);

create policy "team members create tasks as themselves"
  on public.tasks for insert
  to authenticated
  with check ((select auth.uid()) = created_by and (select auth.uid()) = updated_by);

create policy "team members update tasks and sign the change"
  on public.tasks for update
  to authenticated
  using (true)
  with check ((select auth.uid()) = updated_by);

create policy "team members delete tasks"
  on public.tasks for delete
  to authenticated
  using (true);

revoke all on public.tasks from anon, authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

alter publication supabase_realtime add table public.tasks;

-- Projects are team-owned now: anyone on the team may rename or remove one.
drop policy "project creators update their projects" on public.projects;
drop policy "project creators delete their projects" on public.projects;

create policy "team members update projects"
  on public.projects for update
  to authenticated
  using (true)
  with check (true);

create policy "team members delete projects"
  on public.projects for delete
  to authenticated
  using (true);

-- v1 snapshots are superseded by the tasks table.
drop table public.task_snapshots;
