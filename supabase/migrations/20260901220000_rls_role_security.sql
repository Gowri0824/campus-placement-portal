-- Campus Recruitment Portal RLS and role-security hardening.
-- Existing application data and authentication users are preserved.

begin;

select pg_advisory_xact_lock(
  hashtext('campus-placement-portal:rls-role-security')
);

-- Stop before changing security if live values do not match the application's
-- confirmed role and application-status vocabulary.
do $preflight$
begin
  if exists (
    select 1
    from public.profiles
    where role not in ('student', 'admin', 'recruiter')
  ) then
    raise exception 'RLS migration stopped: profiles contains an unsupported role';
  end if;

  if exists (
    select 1
    from public.applications
    where status is null
      or status not in ('Applied', 'Selected', 'Rejected')
  ) then
    raise exception 'RLS migration stopped: applications contains a null or unsupported status';
  end if;
end
$preflight$;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.companies enable row level security;
alter table public.placement_drives enable row level security;
alter table public.applications enable row level security;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'admin', 'recruiter'))
  not valid;

alter table public.profiles
  validate constraint profiles_role_check;

alter table public.applications
  add constraint applications_status_check
  check (
    status is not null
    and status in ('Applied', 'Selected', 'Rejected')
  )
  not valid;

alter table public.applications
  validate constraint applications_status_check;

-- SECURITY DEFINER avoids recursive profiles policies. The empty search_path
-- and fully qualified relations prevent object-shadowing attacks.
create function public.portal_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = any(allowed_roles)
  );
$function$;

alter function public.portal_has_role(text[]) owner to postgres;
revoke all on function public.portal_has_role(text[]) from public, anon, authenticated;
grant execute on function public.portal_has_role(text[]) to authenticated;

create function public.portal_owns_student(requested_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.students as student
    join public.profiles as profile on profile.id = student.profile_id
    where student.id = requested_student_id
      and student.profile_id = (select auth.uid())
      and profile.role = 'student'
  );
$function$;

alter function public.portal_owns_student(uuid) owner to postgres;
revoke all on function public.portal_owns_student(uuid) from public, anon, authenticated;
grant execute on function public.portal_owns_student(uuid) to authenticated;

-- Existing policies retained by name, with the unsafe or overly broad clauses
-- corrected in place.
alter policy "Users can insert own profile"
on public.profiles
to authenticated
with check (
  (select auth.uid()) = id
  and role = 'student'
);

alter policy "Users can read own profile"
on public.profiles
to authenticated
using ((select auth.uid()) = id);

alter policy "Admins can view all students"
on public.students
to authenticated
using (public.portal_has_role(array['admin']::text[]));

alter policy "Users can insert own student record"
on public.students
to authenticated
with check (
  (select auth.uid()) = profile_id
  and public.portal_has_role(array['student']::text[])
  and (
    resume_url is null
    or btrim(resume_url) = ''
    or resume_url like ((select auth.uid())::text || '/%')
    or resume_url like ('%/resumes/' || (select auth.uid())::text || '/%')
  )
);

alter policy "Users can read own student record"
on public.students
to authenticated
using (
  (select auth.uid()) = profile_id
  and public.portal_has_role(array['student']::text[])
);

alter policy "Users can update own student record"
on public.students
to authenticated
using (
  (select auth.uid()) = profile_id
  and public.portal_has_role(array['student']::text[])
)
with check (
  (select auth.uid()) = profile_id
  and public.portal_has_role(array['student']::text[])
  and (
    resume_url is null
    or btrim(resume_url) = ''
    or resume_url like ((select auth.uid())::text || '/%')
    or resume_url like ('%/resumes/' || (select auth.uid())::text || '/%')
  )
);

alter policy "Admins can view all companies"
on public.companies
to authenticated
using (public.portal_has_role(array['admin']::text[]));

alter policy "Admins can view all placement drives"
on public.placement_drives
to authenticated
using (public.portal_has_role(array['admin']::text[]));

alter policy "Admins can view all applications"
on public.applications
to authenticated
using (public.portal_has_role(array['admin']::text[]));

-- New policies fill only the missing operations.
create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using (public.portal_has_role(array['admin']::text[]));

create policy "Users can update own profile details"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Students and recruiters can view companies"
on public.companies
for select
to authenticated
using (
  public.portal_has_role(array['student', 'recruiter']::text[])
);

create policy "Admins can create companies"
on public.companies
for insert
to authenticated
with check (public.portal_has_role(array['admin']::text[]));

create policy "Admins can update companies"
on public.companies
for update
to authenticated
using (public.portal_has_role(array['admin']::text[]))
with check (public.portal_has_role(array['admin']::text[]));

create policy "Admins can delete companies"
on public.companies
for delete
to authenticated
using (public.portal_has_role(array['admin']::text[]));

create policy "Students and recruiters can view placement drives"
on public.placement_drives
for select
to authenticated
using (
  public.portal_has_role(array['student', 'recruiter']::text[])
);

create policy "Admins can create placement drives"
on public.placement_drives
for insert
to authenticated
with check (public.portal_has_role(array['admin']::text[]));

create policy "Admins can update placement drives"
on public.placement_drives
for update
to authenticated
using (public.portal_has_role(array['admin']::text[]))
with check (public.portal_has_role(array['admin']::text[]));

create policy "Admins can delete placement drives"
on public.placement_drives
for delete
to authenticated
using (public.portal_has_role(array['admin']::text[]));

create policy "Students can view own applications"
on public.applications
for select
to authenticated
using (public.portal_owns_student(student_id));

create policy "Students can create own applications"
on public.applications
for insert
to authenticated
with check (
  student_id is not null
  and drive_id is not null
  and status = 'Applied'
  and public.portal_owns_student(student_id)
);

create policy "Admins can update application status"
on public.applications
for update
to authenticated
using (public.portal_has_role(array['admin']::text[]))
with check (
  public.portal_has_role(array['admin']::text[])
  and status in ('Applied', 'Selected', 'Rejected')
);

-- Replace Supabase's broad default grants with the operations and columns used
-- by the frontend. RLS still decides which rows an authenticated request sees.
revoke all privileges on table
  public.profiles,
  public.students,
  public.companies,
  public.placement_drives,
  public.applications
from anon;

revoke all privileges on table
  public.profiles,
  public.students,
  public.companies,
  public.placement_drives,
  public.applications
from authenticated;

grant select on table public.profiles to authenticated;
grant insert (id, role, full_name, email) on public.profiles to authenticated;
grant update (full_name, email) on public.profiles to authenticated;

grant select on table public.students to authenticated;
grant insert (
  profile_id,
  roll_number,
  branch,
  cgpa,
  graduation_year,
  skills,
  resume_url
) on public.students to authenticated;
grant update (
  branch,
  cgpa,
  graduation_year,
  skills,
  resume_url
) on public.students to authenticated;

grant select, delete on table public.companies to authenticated;
grant insert (
  company_name,
  website,
  description,
  location
) on public.companies to authenticated;
grant update (
  company_name,
  website,
  description,
  location
) on public.companies to authenticated;

grant select, delete on table public.placement_drives to authenticated;
grant insert (
  company_id,
  role,
  min_cgpa,
  allowed_branches,
  package,
  deadline
) on public.placement_drives to authenticated;
grant update (
  company_id,
  role,
  min_cgpa,
  allowed_branches,
  package,
  deadline
) on public.placement_drives to authenticated;

grant select on table public.applications to authenticated;
grant insert (student_id, drive_id, status) on public.applications to authenticated;
grant update (status) on public.applications to authenticated;

-- Resume files contain private student data. Preserve all objects and existing
-- database values while making the bucket private and enforcing folder owners.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'resumes',
  'resumes',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow public read" on storage.objects;
drop policy if exists "Students can upload own resumes" on storage.objects;
drop policy if exists "Students can update own resumes" on storage.objects;
drop policy if exists "Students can read own resumes" on storage.objects;
drop policy if exists "Admins can read resumes" on storage.objects;

create policy "Students can upload own resumes"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.portal_has_role(array['student']::text[])
);

create policy "Students can update own resumes"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.portal_has_role(array['student']::text[])
)
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.portal_has_role(array['student']::text[])
);

create policy "Students can read own resumes"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.portal_has_role(array['student']::text[])
);

create policy "Admins can read resumes"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resumes'
  and public.portal_has_role(array['admin']::text[])
);

-- Transactional catalog assertions. Any failed assertion rolls back every
-- policy, grant, function, bucket, and constraint change above.
do $verification$
declare
  secured_table_count integer;
begin
  select count(*)
  into secured_table_count
  from pg_class as relation
  join pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname in (
      'profiles',
      'students',
      'companies',
      'placement_drives',
      'applications'
    )
    and relation.relrowsecurity;

  if secured_table_count <> 5 then
    raise exception 'RLS verification failed: expected five secured public tables';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'profiles',
        'students',
        'companies',
        'placement_drives',
        'applications'
      )
      and grantee = 'anon'
  ) then
    raise exception 'RLS verification failed: anon still has a portal table grant';
  end if;

  if has_column_privilege(
    'authenticated',
    'public.profiles',
    'role',
    'UPDATE'
  ) then
    raise exception 'RLS verification failed: authenticated can update profiles.role';
  end if;

  if not has_column_privilege(
    'authenticated',
    'public.applications',
    'status',
    'UPDATE'
  ) then
    raise exception 'RLS verification failed: application status update grant is missing';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id = 'resumes'
      and public
  ) then
    raise exception 'RLS verification failed: resumes bucket is still public';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'SELECT'
      and 'public' = any(roles)
      and coalesce(qual, '') like '%resumes%'
  ) then
    raise exception 'RLS verification failed: public resume-read policy remains';
  end if;
end
$verification$;

notify pgrst, 'reload schema';

commit;
