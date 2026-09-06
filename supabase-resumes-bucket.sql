-- Run this after the RLS role-security migration to create or repair the private
-- resumes bucket. Each student uploads into a folder named with their auth id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf'])
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
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.portal_has_role(array['student']::text[])
);

create policy "Students can update own resumes"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.portal_has_role(array['student']::text[])
)
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.portal_has_role(array['student']::text[])
);

create policy "Students can read own resumes"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
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
