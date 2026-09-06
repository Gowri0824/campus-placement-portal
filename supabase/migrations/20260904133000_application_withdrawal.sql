-- Add non-destructive student application withdrawal while preserving Admin
-- status management, ownership RLS, uniqueness, and eligibility enforcement.

begin;

select pg_advisory_xact_lock(
  hashtext('campus-placement-portal:application-withdrawal')
);

do $preflight$
begin
  if exists (
    select 1
    from public.applications
    where status is null
      or status not in ('Applied', 'Selected', 'Rejected', 'Withdrawn')
  ) then
    raise exception 'Application withdrawal migration stopped: unsupported or null application statuses exist';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_metadata
    where constraint_metadata.conrelid = 'public.applications'::regclass
      and constraint_metadata.conname = 'applications_status_check'
      and constraint_metadata.contype = 'c'
      and constraint_metadata.convalidated
  ) then
    raise exception 'Application withdrawal migration requires the validated applications_status_check constraint';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'Students can withdraw own applied applications'
  ) then
    raise exception 'Student withdrawal policy already exists under the requested name';
  end if;
end
$preflight$;

-- Validate the expanded domain before removing the previous check, so there is
-- no point in the transaction where existing rows are left unchecked.
alter table public.applications
  add constraint applications_status_check_withdrawn
  check (
    status is not null
    and status in ('Applied', 'Selected', 'Rejected', 'Withdrawn')
  )
  not valid;

alter table public.applications
  validate constraint applications_status_check_withdrawn;

alter table public.applications
  drop constraint applications_status_check;

alter table public.applications
  rename constraint applications_status_check_withdrawn
  to applications_status_check;

alter policy "Admins can update application status"
on public.applications
to authenticated
using (public.portal_has_role(array['admin']::text[]))
with check (
  public.portal_has_role(array['admin']::text[])
  and status in ('Applied', 'Selected', 'Rejected', 'Withdrawn')
);

create policy "Students can withdraw own applied applications"
on public.applications
for update
to authenticated
using (
  status = 'Applied'
  and public.portal_owns_student(student_id)
)
with check (
  status = 'Withdrawn'
  and public.portal_owns_student(student_id)
);

do $verification$
begin
  if not exists (
    select 1
    from pg_constraint as constraint_metadata
    where constraint_metadata.conrelid = 'public.applications'::regclass
      and constraint_metadata.conname = 'applications_status_check'
      and constraint_metadata.contype = 'c'
      and constraint_metadata.convalidated
      and pg_get_constraintdef(constraint_metadata.oid, true) like '%Withdrawn%'
  ) then
    raise exception 'Withdrawn status constraint verification failed';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'Students can withdraw own applied applications'
      and cmd = 'UPDATE'
      and qual like '%status = ''Applied''%'
      and qual like '%portal_owns_student(student_id)%'
      and with_check like '%status = ''Withdrawn''%'
      and with_check like '%portal_owns_student(student_id)%'
  ) then
    raise exception 'Student withdrawal RLS verification failed';
  end if;

  if not has_column_privilege(
    'authenticated',
    'public.applications',
    'status',
    'UPDATE'
  ) then
    raise exception 'Authenticated status update grant is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_metadata
    where constraint_metadata.conrelid = 'public.applications'::regclass
      and constraint_metadata.conname = 'applications_student_drive_unique'
      and constraint_metadata.contype = 'u'
      and constraint_metadata.convalidated
  ) then
    raise exception 'Existing duplicate-application protection was not preserved';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger_metadata
    where trigger_metadata.tgrelid = 'public.applications'::regclass
      and trigger_metadata.tgname = 'applications_enforce_eligibility_before_insert'
      and not trigger_metadata.tgisinternal
      and trigger_metadata.tgenabled <> 'D'
  ) then
    raise exception 'Existing application eligibility protection was not preserved';
  end if;
end
$verification$;

notify pgrst, 'reload schema';

commit;
