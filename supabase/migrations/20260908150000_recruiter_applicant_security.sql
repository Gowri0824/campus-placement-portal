-- Read-only applicant access. No data, lifecycle triggers, or existing role grants change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(hashtext('campus-placement-portal:recruiter-company-security'));

do $preflight$
begin
  if to_regprocedure('public.portal_recruiter_company_id()') is null
    or has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') then
    raise exception 'Recruiter membership and protected profile roles are required';
  end if;
  if (select count(*) from pg_class where oid in ('public.applications'::regclass,
      'public.students'::regclass, 'public.profiles'::regclass, 'public.placement_drives'::regclass,
      'public.recruiter_companies'::regclass, 'storage.objects'::regclass) and relrowsecurity) <> 6 then
    raise exception 'Expected RLS on every applicant authorization table';
  end if;
  if not exists (select 1 from storage.buckets where id = 'resumes' and public = false) then
    raise exception 'The resumes bucket must exist and remain private';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public'
      and (tablename, policyname) in (
        ('students', 'Recruiter student access disabled'),
        ('applications', 'Recruiter application access disabled'))
      and cmd = 'ALL' and permissive = 'RESTRICTIVE' and roles = array['authenticated']::name[]
      and qual = '(NOT portal_has_role(ARRAY[''recruiter''::text]))'
      and with_check = qual) <> 2 then
    raise exception 'Recruiter denial policies differ from the audited definitions; inspect before applying';
  end if;
end
$preflight$;

-- These helpers resolve only the calling recruiter's scope. Definer reads avoid
-- applications -> students -> profiles -> applications RLS recursion.
create function public.portal_recruiter_drive_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $function$
  select drive.id from public.placement_drives drive
  where drive.company_id = (select public.portal_recruiter_company_id());
$function$;

create function public.portal_recruiter_applicant_ids()
returns table(student_id uuid, profile_id uuid)
language sql stable security definer set search_path = ''
as $function$
  select distinct student.id, student.profile_id
  from public.students student
  join public.profiles profile on profile.id = student.profile_id and profile.role = 'student'
  join public.applications application on application.student_id = student.id
  where application.drive_id in (select public.portal_recruiter_drive_ids());
$function$;

-- Compatibility with stored paths and legacy Storage URLs. This internal helper
-- never retrieves a URL; malformed/ambiguous paths fail closed.
create function public.portal_resume_object_path(reference text)
returns text language plpgsql immutable set search_path = ''
as $function$
declare
  path text := btrim(reference);
  segment text;
  decoded text;
  bytes bytea;
  parts text[] := array[]::text[];
  position integer;
begin
  if path is null or path = '' then return null; end if;
  if path ~* '^https?://' then
    if path !~* '^https?://[^/]+/storage/v1/object/(public/|sign/)?resumes/' then return null; end if;
    path := regexp_replace(path, '^https?://[^/]+/storage/v1/object/(public/|sign/)?resumes/', '', 'i');
    path := split_part(split_part(path, '?', 1), '#', 1);
  else
    path := regexp_replace(path, '^/+', '');
    path := regexp_replace(path, '^resumes/', '');
  end if;
  foreach segment in array string_to_array(path, '/') loop
    if segment = '' then continue; end if;
    bytes := ''::bytea;
    position := 1;
    while position <= length(segment) loop
      if substr(segment, position, 1) = '%' then
        if substr(segment, position + 1, 2) !~ '^[0-9a-fA-F]{2}$' then return null; end if;
        bytes := bytes || decode(substr(segment, position + 1, 2), 'hex');
        position := position + 3;
      else
        bytes := bytes || convert_to(substr(segment, position, 1), 'UTF8');
        position := position + 1;
      end if;
    end loop;
    decoded := convert_from(bytes, 'UTF8');
    if decoded in ('.', '..') or decoded ~ '[[:cntrl:]]'
      or strpos(decoded, '/') > 0 or strpos(decoded, chr(92)) > 0 then return null; end if;
    parts := array_append(parts, decoded);
  end loop;
  if cardinality(parts) < 2 then return null; end if;
  return array_to_string(parts, '/');
exception when data_exception then
  return null;
end
$function$;

create function public.portal_recruiter_can_read_resume(object_name text)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.students student
    where student.id in (select student_id from public.portal_recruiter_applicant_ids())
      and split_part(object_name, '/', 1) = student.profile_id::text
      and object_name = public.portal_resume_object_path(student.resume_url)
      and exists (
        select 1 from public.applications application
        where application.student_id = student.id
          and application.drive_id in (select public.portal_recruiter_drive_ids())
          and application.status in ('Applied', 'Selected')
      )
  );
$function$;

alter function public.portal_recruiter_drive_ids() owner to postgres;
alter function public.portal_recruiter_applicant_ids() owner to postgres;
alter function public.portal_resume_object_path(text) owner to postgres;
alter function public.portal_recruiter_can_read_resume(text) owner to postgres;
revoke all on function public.portal_recruiter_drive_ids(), public.portal_recruiter_applicant_ids(),
  public.portal_resume_object_path(text), public.portal_recruiter_can_read_resume(text) from public, anon, authenticated;
grant execute on function public.portal_recruiter_drive_ids(), public.portal_recruiter_applicant_ids(),
  public.portal_recruiter_can_read_resume(text) to authenticated;

-- Split the old ALL denials into scoped reads and unchanged write denials.
drop policy "Recruiter application access disabled" on public.applications;
create policy "Recruiters can read company applications" on public.applications for select to authenticated
using (drive_id in (select public.portal_recruiter_drive_ids()));
create policy "Recruiter application scope boundary" on public.applications as restrictive for select to authenticated
using (not public.portal_has_role(array['recruiter']::text[])
  or drive_id in (select public.portal_recruiter_drive_ids()));
create policy "Recruiter application insert disabled" on public.applications as restrictive for insert to authenticated
with check (not public.portal_has_role(array['recruiter']::text[]));
create policy "Recruiter application update disabled" on public.applications as restrictive for update to authenticated
using (not public.portal_has_role(array['recruiter']::text[]))
with check (not public.portal_has_role(array['recruiter']::text[]));
create policy "Recruiter application delete disabled" on public.applications as restrictive for delete to authenticated
using (not public.portal_has_role(array['recruiter']::text[]));

drop policy "Recruiter student access disabled" on public.students;
create policy "Recruiters can read company applicants" on public.students for select to authenticated
using (id in (select student_id from public.portal_recruiter_applicant_ids()));
create policy "Recruiter student scope boundary" on public.students as restrictive for select to authenticated
using (not public.portal_has_role(array['recruiter']::text[])
  or id in (select student_id from public.portal_recruiter_applicant_ids()));
create policy "Recruiter student insert disabled" on public.students as restrictive for insert to authenticated
with check (not public.portal_has_role(array['recruiter']::text[]));
create policy "Recruiter student update disabled" on public.students as restrictive for update to authenticated
using (not public.portal_has_role(array['recruiter']::text[]))
with check (not public.portal_has_role(array['recruiter']::text[]));
create policy "Recruiter student delete disabled" on public.students as restrictive for delete to authenticated
using (not public.portal_has_role(array['recruiter']::text[]));

create policy "Recruiters can read applicant profiles" on public.profiles for select to authenticated
using (id in (select profile_id from public.portal_recruiter_applicant_ids()));
create policy "Recruiter profile scope boundary" on public.profiles as restrictive for select to authenticated
using (not public.portal_has_role(array['recruiter']::text[]) or id = (select auth.uid())
  or id in (select profile_id from public.portal_recruiter_applicant_ids()));

-- SELECT authorizes private downloads/signing, never uploads or profile edits.
-- Old replacement files and withdrawn/rejected-only applicants are excluded.
create policy "Recruiters can read active applicant resumes" on storage.objects for select to authenticated
using (bucket_id = 'resumes' and archived_at is null and not is_delete_marker
  and public.portal_recruiter_can_read_resume(name));
create policy "Recruiter resume scope boundary" on storage.objects as restrictive for select to authenticated
using (not public.portal_has_role(array['recruiter']::text[]) or bucket_id <> 'resumes'
  or (archived_at is null and not is_delete_marker and public.portal_recruiter_can_read_resume(name)));

notify pgrst, 'reload schema';
commit;
