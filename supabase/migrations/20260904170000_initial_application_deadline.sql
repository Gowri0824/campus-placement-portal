-- Enforce placement-drive deadlines for initial applications and share the
-- same UTC date rule with withdrawn-application reactivation.

begin;

select pg_advisory_xact_lock(
  hashtext('campus-placement-portal:application-deadline-integrity')
);

do $preflight$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'placement_drives'
      and column_name = 'deadline'
      and udt_name = 'date'
  ) then
    raise exception 'Initial application deadline migration requires public.placement_drives.deadline to be a date';
  end if;

  if to_regprocedure('public.portal_assert_student_drive_eligibility(uuid,uuid)') is null then
    raise exception 'Shared application eligibility assertion is missing';
  end if;

  if to_regprocedure('public.portal_enforce_application_lifecycle()') is null then
    raise exception 'Application lifecycle trigger function is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger_metadata
    where trigger_metadata.tgrelid = 'public.applications'::regclass
      and trigger_metadata.tgname = 'applications_enforce_eligibility_before_insert'
      and not trigger_metadata.tgisinternal
      and trigger_metadata.tgenabled <> 'D'
  ) then
    raise exception 'Initial application eligibility trigger is missing';
  end if;
end
$preflight$;

create function public.portal_assert_drive_application_open(
  requested_drive_id uuid,
  requested_operation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  drive_deadline date;
  current_utc_date date := (timezone('UTC', statement_timestamp()))::date;
  error_prefix text;
begin
  if requested_operation not in ('apply', 'reapply') then
    raise exception 'Unsupported application deadline operation';
  end if;

  error_prefix := case requested_operation
    when 'reapply' then 'APPLICATION_REAPPLY_CLOSED: '
    else 'APPLICATION_DEADLINE_CLOSED: '
  end;

  select drive.deadline
  into drive_deadline
  from public.placement_drives as drive
  where drive.id = requested_drive_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = error_prefix || 'The placement drive does not exist.';
  end if;

  if drive_deadline is null then
    raise exception using
      errcode = 'P0001',
      message = error_prefix || 'The application deadline is not configured.';
  end if;

  if current_utc_date > drive_deadline then
    raise exception using
      errcode = 'P0001',
      message = error_prefix || 'The application deadline has closed.';
  end if;
end
$function$;

alter function public.portal_assert_drive_application_open(uuid, text)
owner to postgres;
revoke all on function public.portal_assert_drive_application_open(uuid, text)
from public, anon, authenticated;

create or replace function public.portal_enforce_application_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.portal_assert_drive_application_open(new.drive_id, 'apply');
  perform public.portal_assert_student_drive_eligibility(
    new.student_id,
    new.drive_id
  );

  return new;
end
$function$;

alter function public.portal_enforce_application_eligibility() owner to postgres;
revoke all on function public.portal_enforce_application_eligibility()
from public, anon, authenticated;

create or replace function public.portal_enforce_application_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Admin updates do not satisfy portal_owns_student and retain their existing
  -- status-management behavior. RLS handles non-owner Student requests.
  if (select auth.uid()) is null
    or not public.portal_owns_student(old.student_id) then
    return new;
  end if;

  if new.student_id is distinct from old.student_id
    or new.drive_id is distinct from old.drive_id then
    raise exception using
      errcode = '42501',
      message = 'Student application references cannot be changed.';
  end if;

  if old.status = 'Applied' and new.status = 'Withdrawn' then
    return new;
  end if;

  if old.status = 'Withdrawn' and new.status = 'Applied' then
    perform public.portal_assert_drive_application_open(new.drive_id, 'reapply');
    perform public.portal_assert_student_drive_eligibility(
      new.student_id,
      new.drive_id
    );

    return new;
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'APPLICATION_STATUS_TRANSITION_DENIED: This application status change is not allowed.';
end
$function$;

alter function public.portal_enforce_application_lifecycle() owner to postgres;
revoke all on function public.portal_enforce_application_lifecycle()
from public, anon, authenticated;

do $verification$
begin
  if position(
    'portal_assert_drive_application_open(new.drive_id, ''apply'')'
    in pg_get_functiondef(
      'public.portal_enforce_application_eligibility()'::regprocedure
    )
  ) = 0 then
    raise exception 'Initial application deadline assertion was not installed';
  end if;

  if position(
    'portal_assert_drive_application_open(new.drive_id, ''reapply'')'
    in pg_get_functiondef(
      'public.portal_enforce_application_lifecycle()'::regprocedure
    )
  ) = 0 then
    raise exception 'Re-application deadline assertion was not preserved';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_metadata
    where constraint_metadata.conrelid = 'public.applications'::regclass
      and constraint_metadata.conname = 'applications_student_drive_unique'
      and constraint_metadata.contype = 'u'
      and constraint_metadata.convalidated
  ) then
    raise exception 'Application uniqueness constraint was not preserved';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'Students can manage own application lifecycle'
      and cmd = 'UPDATE'
  ) then
    raise exception 'Student application lifecycle policy was not preserved';
  end if;
end
$verification$;

notify pgrst, 'reload schema';

commit;
