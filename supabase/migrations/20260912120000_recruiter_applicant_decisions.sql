-- Recruiter decisions only; existing Student/Admin lifecycle and grants stay intact.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(hashtext('campus-placement-portal:recruiter-company-security'));
select pg_advisory_xact_lock(hashtext('campus-placement-portal:application-lifecycle'));

do $preflight$
begin
  if to_regprocedure('public.portal_recruiter_drive_ids()') is null
    or not (select relrowsecurity from pg_class where oid = 'public.applications'::regclass) then
    raise exception 'Recruiter drive scope and application RLS are required';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applications'
    and policyname = 'Recruiter application update disabled' and cmd = 'UPDATE'
    and permissive = 'RESTRICTIVE' and roles = array['authenticated']::name[]
    and qual = '(NOT portal_has_role(ARRAY[''recruiter''::text]))' and with_check = qual) then
    raise exception 'Recruiter update policy differs from the audited definition';
  end if;
  if (select count(*) from information_schema.column_privileges where table_schema = 'public'
    and table_name = 'applications' and grantee = 'authenticated' and privilege_type = 'UPDATE') <> 1
    or not has_column_privilege('authenticated', 'public.applications', 'status', 'UPDATE')
    or has_table_privilege('authenticated', 'public.applications', 'DELETE')
    or has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') then
    raise exception 'Expected status-only UPDATE, no DELETE, and protected profile roles';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'applications'
    and policyname in ('Admins can update application status', 'Students can manage own application lifecycle',
      'Recruiter application insert disabled', 'Recruiter application delete disabled')) <> 4 then
    raise exception 'Expected existing Admin/Student policies and recruiter insert/delete boundaries';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.applications'::regclass
    and tgname in ('applications_00_guard_owner_before_insert', 'applications_enforce_eligibility_before_insert',
      'applications_enforce_student_lifecycle_before_update') and not tgisinternal and tgenabled = 'O') <> 3 then
    raise exception 'Expected enabled ownership, eligibility/deadline and Student lifecycle triggers';
  end if;
  if (select count(*) from pg_constraint where conrelid = 'public.applications'::regclass
    and conname in ('applications_student_drive_unique', 'applications_status_check') and convalidated) <> 2 then
    raise exception 'Expected validated application uniqueness and status constraints';
  end if;
end
$preflight$;

-- Restrictive policies protect scope even if another permissive policy is added.
alter policy "Recruiter application update disabled" on public.applications
using (not public.portal_has_role(array['recruiter']::text[])
  or (status = 'Applied' and drive_id in (select public.portal_recruiter_drive_ids())))
with check (not public.portal_has_role(array['recruiter']::text[])
  or (status in ('Selected', 'Rejected') and drive_id in (select public.portal_recruiter_drive_ids())));
alter policy "Recruiter application update disabled" on public.applications
rename to "Recruiter application decision boundary";

create policy "Recruiters can decide company applications" on public.applications for update to authenticated
using (public.portal_has_role(array['recruiter']::text[])
  and status = 'Applied' and drive_id in (select public.portal_recruiter_drive_ids()))
with check (public.portal_has_role(array['recruiter']::text[])
  and status in ('Selected', 'Rejected') and drive_id in (select public.portal_recruiter_drive_ids()));

-- RLS checks OLD/NEW row access; this guard independently enforces the transition
-- and prevents changing any other column, including future application metadata.
create function public.portal_enforce_recruiter_application_decision()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if not public.portal_has_role(array['recruiter']::text[]) then return new; end if;
  if not exists (select 1 from public.portal_recruiter_drive_ids() id where id = old.drive_id)
    or (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception using errcode = '42501',
      message = 'APPLICATION_STATUS_TRANSITION_DENIED: Only the status of your company application may be changed.';
  end if;
  if old.status is distinct from 'Applied' or new.status is null or new.status not in ('Selected', 'Rejected') then
    raise exception using errcode = 'P0001',
      message = 'APPLICATION_STATUS_TRANSITION_DENIED: Recruiters may only select or reject an Applied application. Reload to check its current status.';
  end if;
  return new;
end
$function$;
alter function public.portal_enforce_recruiter_application_decision() owner to postgres;
revoke all on function public.portal_enforce_recruiter_application_decision() from public, anon, authenticated;
create trigger applications_enforce_recruiter_decision_before_update
before update on public.applications for each row
execute function public.portal_enforce_recruiter_application_decision();

notify pgrst, 'reload schema';
commit;
