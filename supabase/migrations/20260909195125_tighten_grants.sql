-- Supabase's default privileges grant every table privilege to anon and
-- authenticated at create time, ahead of the explicit grants in the init
-- migration. Reset both roles to exactly what the dashboard needs.
--
-- anon: nothing. Every read and write requires a signed-in team member.
-- authenticated: the minimum per table; RLS then narrows rows to owners.

revoke all on public.profiles, public.projects, public.activity_events, public.task_snapshots
  from anon;

revoke all on public.profiles, public.projects, public.activity_events, public.task_snapshots
  from authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, delete on public.activity_events to authenticated;
grant select, insert, update, delete on public.task_snapshots to authenticated;
