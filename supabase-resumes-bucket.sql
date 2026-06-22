-- Run this once in the Supabase SQL Editor to create the resumes bucket.
-- The React app uploads each student's resume into a folder named with their auth user id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', true, 10485760, array['application/pdf'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Students can upload their own resumes" on storage.objects;
drop policy if exists "Students can replace their own resumes" on storage.objects;
drop policy if exists "Students can read resumes" on storage.objects;

create policy "Students can upload their own resumes"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Students can replace their own resumes"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Students can read resumes"
on storage.objects
for select
to authenticated
using (bucket_id = 'resumes');
