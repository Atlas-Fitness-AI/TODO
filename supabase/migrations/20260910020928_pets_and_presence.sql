-- Pets: each team member picks a companion; it appears on the tasks they
-- are actively working on. Names are fixed per species in the dashboard.
alter table public.profiles
  add column pet text
  check (pet in ('cat', 'dog', 'frog', 'octopus', 'owl', 'snail', 'robot', 'dragon'));

-- Who moved the task into Active. Set by sync on the transition, cleared
-- when the task leaves Active. Distinct from created_by (the author).
alter table public.tasks
  add column active_by uuid references public.profiles (id) on delete set null;

create index tasks_active_by_idx on public.tasks (active_by) where active_by is not null;
