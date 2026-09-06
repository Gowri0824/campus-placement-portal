-- Allow a student to reactivate their own withdrawn application before the
-- drive deadline, using the existing row and rechecking current eligibility.

begin;

select pg_advisory_xact_lock(
  hashtext('campus-placement-portal:application-lifecycle')
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
    raise exception 'Application re-apply migration requires public.placement_drives.deadline to be a date';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'Students can withdraw own applied applications'
      and cmd = 'UPDATE'
  ) then
    raise exception 'Application re-apply migration requires the existing Student withdrawal policy';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'Students can manage own application lifecycle'
  ) then
    raise exception 'Student application lifecycle policy already exists';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger_metadata
    where trigger_metadata.tgrelid = 'public.applications'::regclass
      and trigger_metadata.tgname = 'applications_enforce_eligibility_before_insert'
      and not trigger_metadata.tgisinternal
      and trigger_metadata.tgenabled <> 'D'
  ) then
    raise exception 'Application re-apply migration requires the existing insert eligibility trigger';
  end if;
end
$preflight$;

-- A private shared assertion keeps initial applications and re-applications on
-- exactly the same CGPA and branch rules.
create function public.portal_assert_student_drive_eligibility(
  requested_student_id uuid,
  requested_drive_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  student_cgpa numeric;
  student_branch text;
  drive_min_cgpa numeric;
  drive_allowed_branches text;
  branch_criteria text;
  branch_json jsonb;
  branch_json_value jsonb;
  branch_values text[] := array[]::text[];
  normalized_allowed_branches text[] := array[]::text[];
  branch_value text;
  normalized_branch text;
  normalized_student_branch text;
begin
  select student.cgpa, student.branch
  into student_cgpa, student_branch
  from public.students as student
  where student.id = requested_student_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'APPLICATION_NOT_ELIGIBLE: The student record does not exist.',
      constraint = 'applications_eligibility_check';
  end if;

  select drive.min_cgpa, drive.allowed_branches
  into drive_min_cgpa, drive_allowed_branches
  from public.placement_drives as drive
  where drive.id = requested_drive_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'APPLICATION_NOT_ELIGIBLE: The placement drive does not exist.',
      constraint = 'applications_eligibility_check';
  end if;

  if drive_min_cgpa is not null then
    if drive_min_cgpa < 0 or drive_min_cgpa > 10 then
      raise exception using
        errcode = 'P0001',
        message = 'APPLICATION_NOT_ELIGIBLE: The drive has an invalid minimum CGPA criterion.',
        constraint = 'applications_eligibility_check';
    end if;

    if student_cgpa is null or student_cgpa < drive_min_cgpa then
      raise exception using
        errcode = 'P0001',
        message = 'APPLICATION_NOT_ELIGIBLE: You do not meet the minimum CGPA requirement.',
        constraint = 'applications_eligibility_check';
    end if;
  end if;

  branch_criteria := btrim(coalesce(drive_allowed_branches, ''));

  if branch_criteria = '' then
    return;
  end if;

  if left(branch_criteria, 1) = '[' then
    begin
      branch_json := branch_criteria::jsonb;
    exception
      when invalid_text_representation then
        raise exception using
          errcode = 'P0001',
          message = 'APPLICATION_NOT_ELIGIBLE: The drive has malformed branch criteria.',
          constraint = 'applications_eligibility_check';
    end;

    if jsonb_typeof(branch_json) <> 'array' then
      raise exception using
        errcode = 'P0001',
        message = 'APPLICATION_NOT_ELIGIBLE: The drive has malformed branch criteria.',
        constraint = 'applications_eligibility_check';
    end if;

    for branch_json_value in
      select branch_element.value
      from jsonb_array_elements(branch_json) as branch_element(value)
    loop
      if jsonb_typeof(branch_json_value) <> 'string' then
        raise exception using
          errcode = 'P0001',
          message = 'APPLICATION_NOT_ELIGIBLE: The drive has malformed branch criteria.',
          constraint = 'applications_eligibility_check';
      end if;

      branch_values := array_append(
        branch_values,
        branch_json_value #>> '{}'
      );
    end loop;
  else
    branch_values := regexp_split_to_array(
      branch_criteria,
      E'[,;|\\n\\r]+'
    );
  end if;

  foreach branch_value in array branch_values
  loop
    normalized_branch := lower(
      regexp_replace(btrim(branch_value), '[[:space:]]+', ' ', 'g')
    );

    if normalized_branch <> '' then
      normalized_allowed_branches := array_append(
        normalized_allowed_branches,
        normalized_branch
      );
    end if;
  end loop;

  if cardinality(normalized_allowed_branches) = 0
    or normalized_allowed_branches && array['all', 'all branches', 'any', '*']::text[] then
    return;
  end if;

  normalized_student_branch := lower(
    regexp_replace(btrim(coalesce(student_branch, '')), '[[:space:]]+', ' ', 'g')
  );

  if normalized_student_branch = ''
    or not (normalized_student_branch = any(normalized_allowed_branches)) then
    raise exception using
      errcode = 'P0001',
      message = 'APPLICATION_NOT_ELIGIBLE: Your branch is not allowed for this drive.',
      constraint = 'applications_eligibility_check';
  end if;
end
$function$;

alter function public.portal_assert_student_drive_eligibility(uuid, uuid)
owner to postgres;
revoke all on function public.portal_assert_student_drive_eligibility(uuid, uuid)
from public, anon, authenticated;

create or replace function public.portal_enforce_application_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
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

create function public.portal_enforce_application_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  drive_deadline date;
  current_utc_date date := (timezone('UTC', statement_timestamp()))::date;
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
    select drive.deadline
    into drive_deadline
    from public.placement_drives as drive
    where drive.id = new.drive_id;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'APPLICATION_REAPPLY_CLOSED: The placement drive does not exist.';
    end if;

    if drive_deadline is null then
      raise exception using
        errcode = 'P0001',
        message = 'APPLICATION_REAPPLY_CLOSED: The application deadline is not configured.';
    end if;

    if current_utc_date > drive_deadline then
      raise exception using
        errcode = 'P0001',
        message = 'APPLICATION_REAPPLY_CLOSED: The application deadline has closed.';
    end if;

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

create trigger applications_enforce_student_lifecycle_before_update
before update of status on public.applications
for each row
execute function public.portal_enforce_application_lifecycle();

drop policy "Students can withdraw own applied applications"
on public.applications;

create policy "Students can manage own application lifecycle"
on public.applications
for update
to authenticated
using (
  status in ('Applied', 'Withdrawn')
  and public.portal_owns_student(student_id)
)
with check (
  status in ('Applied', 'Withdrawn')
  and public.portal_owns_student(student_id)
);

do $verification$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'Students can withdraw own applied applications'
  ) then
    raise exception 'Previous Student withdrawal policy was not replaced';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'Students can manage own application lifecycle'
      and cmd = 'UPDATE'
      and qual like '%Applied%'
      and qual like '%Withdrawn%'
      and qual like '%portal_owns_student(student_id)%'
      and with_check like '%Applied%'
      and with_check like '%Withdrawn%'
      and with_check like '%portal_owns_student(student_id)%'
  ) then
    raise exception 'Student application lifecycle RLS verification failed';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger_metadata
    where trigger_metadata.tgrelid = 'public.applications'::regclass
      and trigger_metadata.tgname = 'applications_enforce_student_lifecycle_before_update'
      and not trigger_metadata.tgisinternal
      and trigger_metadata.tgenabled <> 'D'
  ) then
    raise exception 'Student application lifecycle trigger verification failed';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_metadata
    where constraint_metadata.conrelid = 'public.applications'::regclass
      and constraint_metadata.conname = 'applications_student_drive_unique'
      and constraint_metadata.contype = 'u'
      and constraint_metadata.convalidated
  ) then
    raise exception 'Existing duplicate application constraint was not preserved';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger_metadata
    where trigger_metadata.tgrelid = 'public.applications'::regclass
      and trigger_metadata.tgname = 'applications_enforce_eligibility_before_insert'
      and not trigger_metadata.tgisinternal
      and trigger_metadata.tgenabled <> 'D'
  ) then
    raise exception 'Existing insert eligibility trigger was not preserved';
  end if;
end
$verification$;

notify pgrst, 'reload schema';

commit;
