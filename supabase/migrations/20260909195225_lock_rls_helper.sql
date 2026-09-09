-- Projects created with "Enable automatic RLS" ship a SECURITY DEFINER event
-- trigger function in public. Event trigger functions cannot be called
-- through the Data API, but revoking execute keeps the security advisor
-- clean. Skipped on projects that never had the function.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
