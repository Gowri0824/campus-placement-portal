-- Reject non-owner application inserts before the eligibility trigger reads a
-- student's private academic fields. RLS remains the final ownership boundary.

begin;

select pg_advisory_xact_lock(
  hashtext('campus-placement-portal:application-integrity')
);

do $preflight$
begin
  if to_regprocedure('public.portal_owns_student(uuid)') is null then
    raise exception 'Application owner guard requires public.portal_owns_student(uuid)';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger_metadata
    where trigger_metadata.tgrelid = 'public.applications'::regclass
      and trigger_metadata.tgname = 'applications_enforce_eligibility_before_insert'
      and not trigger_metadata.tgisinternal
      and trigger_metadata.tgenabled <> 'D'
  ) then
    raise exception 'Application owner guard requires the enabled eligibility trigger';
  end if;
end
$preflight$;

create function public.portal_guard_application_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  authenticated_user_id uuid := (select auth.uid());
  jwt_role text := (select auth.role());
begin
  if (
    authenticated_user_id is not null
    or jwt_role in ('anon', 'authenticated')
  ) and not public.portal_owns_student(new.student_id) then
    raise exception using
      errcode = '42501',
      message = 'new row violates row-level security policy for table "applications"';
  end if;

  return new;
end
$function$;

alter function public.portal_guard_application_owner() owner to postgres;
revoke all on function public.portal_guard_application_owner()
from public, anon, authenticated;

create trigger applications_00_guard_owner_before_insert
before insert on public.applications
for each row
execute function public.portal_guard_application_owner();

do $verification$
declare
  owner_trigger_position integer;
  eligibility_trigger_position integer;
begin
  select trigger_order.position
  into owner_trigger_position
  from (
    select
      trigger_metadata.tgname,
      row_number() over (order by trigger_metadata.tgname) as position
    from pg_trigger as trigger_metadata
    where trigger_metadata.tgrelid = 'public.applications'::regclass
      and not trigger_metadata.tgisinternal
      and trigger_metadata.tgtype & 2 = 2
      and trigger_metadata.tgtype & 4 = 4
      and trigger_metadata.tgenabled <> 'D'
  ) as trigger_order
  where trigger_order.tgname = 'applications_00_guard_owner_before_insert';

  select trigger_order.position
  into eligibility_trigger_position
  from (
    select
      trigger_metadata.tgname,
      row_number() over (order by trigger_metadata.tgname) as position
    from pg_trigger as trigger_metadata
    where trigger_metadata.tgrelid = 'public.applications'::regclass
      and not trigger_metadata.tgisinternal
      and trigger_metadata.tgtype & 2 = 2
      and trigger_metadata.tgtype & 4 = 4
      and trigger_metadata.tgenabled <> 'D'
  ) as trigger_order
  where trigger_order.tgname = 'applications_enforce_eligibility_before_insert';

  if owner_trigger_position is null
    or eligibility_trigger_position is null
    or owner_trigger_position >= eligibility_trigger_position then
    raise exception 'Application owner guard must run before the eligibility trigger';
  end if;
end
$verification$;

commit;
