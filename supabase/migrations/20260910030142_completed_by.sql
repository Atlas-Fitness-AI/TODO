-- Who moved the task into Resolved. Set by sync on the transition, so the
-- finisher's pet stays on the resolved card. Distinct from created_by.
alter table public.tasks
  add column completed_by uuid references public.profiles (id) on delete set null;

create index tasks_completed_by_idx on public.tasks (completed_by) where completed_by is not null;

-- Best-effort backfill for tasks resolved before this column existed.
update public.tasks
  set completed_by = updated_by
  where status = 'Resolved' and completed_by is null;
