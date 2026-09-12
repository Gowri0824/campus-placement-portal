-- Remote, rollback-only SQL authorization tests. No auth users or physical files.
-- Storage fixtures are uncommitted metadata, not an HTTP signing/download test.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

create temporary table applicant_test_ids (name text primary key, id uuid not null default gen_random_uuid());
insert into applicant_test_ids(name) values
  ('admin'), ('recruiter_a'), ('recruiter_b'), ('student_a'), ('student_b'), ('unrelated'), ('shared'),
  ('company_a'), ('company_b'), ('drive_a'), ('drive_b'), ('drive_closed'), ('drive_no_deadline'),
  ('row_a'), ('row_b'), ('row_unrelated'), ('row_shared'),
  ('application_a'), ('application_b'), ('application_shared_a'), ('application_shared_b');
create temporary table applicant_test_results (test text, passed boolean);
grant select on applicant_test_ids to authenticated, anon;
grant insert, select on applicant_test_results to authenticated, anon;

create function pg_temp.test_id(key text) returns uuid language sql as
  'select id from pg_temp.applicant_test_ids where name = key';
create function pg_temp.resume_name(actor text, filename text default 'resume.pdf') returns text language sql as
  'select pg_temp.test_id(actor)::text || ''/fixture/'' || filename';
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $test$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into pg_temp.applicant_test_results values (label, true);
end
$test$;
create function pg_temp.expect_error(statement text, expected_code text, label text, message_prefix text default null)
returns void language plpgsql as $test$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate <> expected_code or (message_prefix is not null and sqlerrm not like message_prefix || '%') then
      raise exception 'FAIL: %, expected % / %, received %: %', label, expected_code, message_prefix, sqlstate, sqlerrm;
    end if;
    insert into pg_temp.applicant_test_results values (label, true);
    return;
  end;
  raise exception 'FAIL: %, expected SQLSTATE % but operation succeeded', label, expected_code;
end
$test$;
create function pg_temp.login_as(actor text) returns void language plpgsql as $test$
begin
  perform set_config('request.jwt.claim.sub', pg_temp.test_id(actor)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.test_id(actor), 'role', 'authenticated')::text, true);
end
$test$;

insert into public.profiles(id, role, full_name, email)
select id, case when name like 'recruiter_%' then 'recruiter'
  when name = 'admin' then 'admin' else 'student' end,
  'Rollback-only applicant fixture', id::text || '@example.invalid'
from applicant_test_ids where name in ('admin', 'recruiter_a', 'recruiter_b', 'student_a', 'student_b', 'unrelated', 'shared');
insert into public.companies(id, company_name) values
  (pg_temp.test_id('company_a'), 'Rollback-only applicant company A'),
  (pg_temp.test_id('company_b'), 'Rollback-only applicant company B');
insert into public.recruiter_companies(profile_id, company_id) values
  (pg_temp.test_id('recruiter_a'), pg_temp.test_id('company_a')),
  (pg_temp.test_id('recruiter_b'), pg_temp.test_id('company_b'));
insert into public.placement_drives(id, company_id, role, deadline, min_cgpa, allowed_branches)
select pg_temp.test_id(key), pg_temp.test_id(company), 'Rollback-only applicant role',
  case when key = 'drive_no_deadline' then null
    else timezone('UTC', statement_timestamp())::date + days end, 6, 'CSE'
from (values ('drive_a', 'company_a', 0), ('drive_b', 'company_b', 1),
  ('drive_closed', 'company_a', -1), ('drive_no_deadline', 'company_a', 0)) as fixtures(key, company, days);
insert into public.students(id, profile_id, branch, cgpa, resume_url)
select pg_temp.test_id(row_key), pg_temp.test_id(actor), 'cse', 8, pg_temp.resume_name(actor)
from (values ('row_a', 'student_a'), ('row_b', 'student_b'),
  ('row_unrelated', 'unrelated'), ('row_shared', 'shared')) as fixtures(row_key, actor);
insert into public.applications(id, student_id, drive_id)
select pg_temp.test_id(key), pg_temp.test_id(student), pg_temp.test_id(drive)
from (values ('application_a', 'row_a', 'drive_a'), ('application_b', 'row_b', 'drive_b'),
  ('application_shared_a', 'row_shared', 'drive_a'), ('application_shared_b', 'row_shared', 'drive_b')) as fixtures(key, student, drive);
-- Only metadata is inserted, and it is always rolled back; no Storage deletion.
insert into storage.objects(bucket_id, name)
select 'resumes', pg_temp.resume_name(actor)
from (values ('student_a'), ('student_b'), ('unrelated'), ('shared')) as fixtures(actor);
insert into storage.objects(bucket_id, name) values
  ('resumes', pg_temp.resume_name('student_a', 'old.pdf')),
  ('resumes', pg_temp.resume_name('student_a', 'new.pdf')),
  ('resumes', pg_temp.resume_name('student_a', 'resume copy.pdf'));
set constraints all immediate;
set constraints all deferred;

select pg_temp.assert_true((select not public from storage.buckets where id = 'resumes'), 'Resume bucket remains private');
select pg_temp.assert_true(public.portal_resume_object_path('/resumes/' || pg_temp.resume_name('student_a'))
  = pg_temp.resume_name('student_a'), 'Stored path and bucket prefix normalize');
select pg_temp.assert_true(public.portal_resume_object_path('https://example.invalid/storage/v1/object/sign/resumes/'
  || pg_temp.resume_name('student_a', 'resume%20copy.pdf') || '?token=fixture')
  = pg_temp.resume_name('student_a', 'resume copy.pdf'), 'Legacy signed URL percent decoding strips token');
select pg_temp.assert_true(public.portal_resume_object_path('https://example.invalid/not-storage/resume.pdf') is null
  and public.portal_resume_object_path('bad/%zz.pdf') is null
  and public.portal_resume_object_path('bad/%2e%2e/resume.pdf') is null
  and public.portal_resume_object_path('bad/%2fresume.pdf') is null
  and public.portal_resume_object_path('bad/%00resume.pdf') is null
  and public.portal_resume_object_path(null) is null, 'Malformed and traversal resume paths fail closed');

set local role authenticated;
select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true(current_user = 'authenticated' and not
  (select rolbypassrls or rolsuper from pg_roles where rolname = current_user), 'Assertions run without RLS bypass');
select pg_temp.assert_true((select count(*) = 2 from public.applications)
  and exists (select 1 from public.applications where id = pg_temp.test_id('application_a')),
  'Recruiter reads own-company applications');
select pg_temp.assert_true(not exists (select 1 from public.applications
  where id in (pg_temp.test_id('application_b'), pg_temp.test_id('application_shared_b'))),
  'Recruiter cannot see other-company applications even for a shared applicant');
select pg_temp.assert_true((select count(*) = 2 from public.students)
  and exists (select 1 from public.students where id = pg_temp.test_id('row_a'))
  and exists (select 1 from public.students where id = pg_temp.test_id('row_shared')), 'Only applicant student rows are visible');
select pg_temp.assert_true((select count(*) = 3 from public.profiles)
  and exists (select 1 from public.profiles where id = pg_temp.test_id('student_a'))
  and exists (select 1 from public.profiles where id = pg_temp.test_id('recruiter_a')), 'Own profile and applicant identities are visible');
select pg_temp.assert_true(not exists (select 1 from public.students where id in (pg_temp.test_id('row_b'), pg_temp.test_id('row_unrelated')))
  and not exists (select 1 from public.profiles where id in (pg_temp.test_id('student_b'), pg_temp.test_id('unrelated'), pg_temp.test_id('admin'), pg_temp.test_id('recruiter_b'))),
  'Unrelated students admins and other recruiters remain private');
select pg_temp.assert_true((select count(*) = 2 from public.applications a
  join public.students s on s.id = a.student_id join public.profiles p on p.id = s.profile_id
  join public.placement_drives d on d.id = a.drive_id join public.companies c on c.id = d.company_id),
  'Applicant detail joins work without recursive RLS');
select pg_temp.assert_true((select count(*) = 2 from storage.objects where bucket_id = 'resumes')
  and exists (select 1 from storage.objects where bucket_id = 'resumes' and name = pg_temp.resume_name('student_a')),
  'Storage SELECT permits current active applicant resumes');
select pg_temp.assert_true(not exists (select 1 from storage.objects where bucket_id = 'resumes'
  and name in (pg_temp.resume_name('student_b'), pg_temp.resume_name('unrelated'), pg_temp.resume_name('student_a', 'old.pdf'))),
  'Unrelated and obsolete applicant resume objects are hidden');
select pg_temp.assert_true(not public.portal_recruiter_can_read_resume(pg_temp.resume_name('student_b')),
  'Resume helper cannot authorize another company applicant');
select pg_temp.expect_error('select public.portal_resume_object_path(''private/path'')', '42501', 'Internal path helper is not a public RPC');
with changed as (update public.applications set status = 'Selected' where id = pg_temp.test_id('application_a') returning id)
select pg_temp.assert_true((select id = pg_temp.test_id('application_a') from changed), 'Recruiter selects own-company Applied application');
with changed as (update public.applications set status = 'Rejected' where id = pg_temp.test_id('application_shared_a') returning id)
select pg_temp.assert_true((select id = pg_temp.test_id('application_shared_a') from changed), 'Recruiter rejects own-company Applied application');
select pg_temp.assert_true((select count(*) = 2 from public.applications), 'Decisions reuse the same application rows');
with changed as (update public.applications set status = 'Rejected' where id = pg_temp.test_id('application_a') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Stale competing decision updates zero rows');
with changed as (update public.applications set status = 'Selected' where id = pg_temp.test_id('application_b') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Other-company application decision denied');
with changed as (update public.applications set status = 'Selected' where id = pg_temp.test_id('application_shared_b') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Shared student does not grant access to other-company application');

do $decisions$
declare previous_status text; next_status text; affected integer;
begin
  foreach previous_status in array array['Selected', 'Rejected', 'Withdrawn'] loop
    perform pg_temp.login_as('admin');
    update public.applications set status = previous_status where id = pg_temp.test_id('application_a');
    perform pg_temp.login_as('recruiter_a');
    foreach next_status in array array['Applied', 'Selected', 'Rejected', 'Withdrawn'] loop
      update public.applications set status = next_status where id = pg_temp.test_id('application_a');
      get diagnostics affected = row_count;
      perform pg_temp.assert_true(affected = 0, 'Recruiter terminal transition denied: ' || previous_status || ' -> ' || next_status);
    end loop;
  end loop;
end
$decisions$;
select pg_temp.login_as('admin');
update public.applications set status = 'Applied' where id in (pg_temp.test_id('application_a'), pg_temp.test_id('application_shared_a'));
select pg_temp.login_as('recruiter_a');
select pg_temp.expect_error($sql$update public.applications set status = 'Withdrawn' where id = pg_temp.test_id('application_a')$sql$,
  'P0001', 'Recruiter cannot withdraw applicant', 'APPLICATION_STATUS_TRANSITION_DENIED:');
select pg_temp.expect_error($sql$update public.applications set status = 'Applied' where id = pg_temp.test_id('application_a')$sql$,
  'P0001', 'Recruiter cannot perform Applied no-op', 'APPLICATION_STATUS_TRANSITION_DENIED:');
select pg_temp.expect_error($sql$update public.applications set status = null where id = pg_temp.test_id('application_a')$sql$,
  'P0001', 'Recruiter null decision denied', 'APPLICATION_STATUS_TRANSITION_DENIED:');
select pg_temp.expect_error($sql$update public.applications set drive_id = pg_temp.test_id('drive_b') where id = pg_temp.test_id('application_a')$sql$,
  '42501', 'Recruiter cannot change application drive');
select pg_temp.expect_error($sql$update public.applications set applied_at = now() where id = pg_temp.test_id('application_a')$sql$,
  '42501', 'Recruiter cannot change application timestamp');
select pg_temp.expect_error($sql$insert into public.applications(student_id, drive_id)
  values (pg_temp.test_id('row_unrelated'), pg_temp.test_id('drive_a'))$sql$, '42501', 'Recruiter cannot create applications');
select pg_temp.expect_error($sql$delete from public.applications where id = pg_temp.test_id('application_a')$sql$,
  '42501', 'Recruiter cannot delete applications');
with changed as (update public.students set cgpa = 10 where id = pg_temp.test_id('row_a') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Recruiter cannot edit applicant academic data');
with changed as (update public.profiles set full_name = 'Denied' where id = pg_temp.test_id('student_a') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Recruiter cannot edit applicant identity');
with changed as (update public.profiles set full_name = 'Rollback-only own name' where id = pg_temp.test_id('recruiter_a') returning id)
select pg_temp.assert_true((select count(*) = 1 from changed), 'Recruiter retains own profile edit');
select pg_temp.expect_error($sql$update public.profiles set role = 'admin' where id = pg_temp.test_id('recruiter_a')$sql$,
  '42501', 'Recruiter cannot self-promote');
select pg_temp.expect_error($sql$insert into storage.objects(bucket_id, name)
  values ('resumes', pg_temp.resume_name('recruiter_a'))$sql$, '42501', 'Recruiter cannot upload resumes');
with changed as (update storage.objects set metadata = '{}'::jsonb
  where bucket_id = 'resumes' and name = pg_temp.resume_name('student_a') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Recruiter cannot replace applicant resume metadata');
select pg_temp.expect_error($sql$delete from storage.objects where bucket_id = 'resumes'
  and name = pg_temp.resume_name('student_a')$sql$, '42501', 'Direct Storage deletion stays protected');
with changed as (update public.recruiter_companies set company_id = pg_temp.test_id('company_b')
  where profile_id = pg_temp.test_id('recruiter_a') returning profile_id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Recruiter cannot switch own company');

select pg_temp.login_as('recruiter_b');
select pg_temp.assert_true((select count(*) = 2 from public.applications)
  and not exists (select 1 from public.applications where id = pg_temp.test_id('application_a'))
  and not exists (select 1 from public.students where id = pg_temp.test_id('row_a'))
  and not exists (select 1 from storage.objects where name = pg_temp.resume_name('student_a')),
  'Second recruiter is independently isolated');
select pg_temp.assert_true(exists (select 1 from public.students where id = pg_temp.test_id('row_shared'))
  and exists (select 1 from storage.objects where name = pg_temp.resume_name('shared')), 'Shared applicant is authorized by each own-company application');

-- All four statuses remain visible; only active statuses permit new resume access.
do $test$
declare next_status text;
begin
  foreach next_status in array array['Selected', 'Rejected', 'Withdrawn', 'Applied'] loop
    perform pg_temp.login_as('admin');
    update public.applications set status = next_status where id = pg_temp.test_id('application_a');
    perform pg_temp.assert_true(found, 'Admin status update: ' || next_status);
    perform pg_temp.login_as('recruiter_a');
    perform pg_temp.assert_true(exists (select 1 from public.applications
      where id = pg_temp.test_id('application_a') and status = next_status), 'Application history readable: ' || next_status);
    perform pg_temp.assert_true(exists (select 1 from public.students where id = pg_temp.test_id('row_a'))
      and exists (select 1 from public.profiles where id = pg_temp.test_id('student_a')), 'Applicant details readable: ' || next_status);
    perform pg_temp.assert_true(exists (select 1 from storage.objects
      where bucket_id = 'resumes' and name = pg_temp.resume_name('student_a')) = (next_status in ('Applied', 'Selected')),
      'Resume access follows active status: ' || next_status);
  end loop;
end
$test$;

-- Student's existing profile/resume updates drive authorization, not cached paths.
select pg_temp.login_as('student_a');
select pg_temp.assert_true((select count(*) = 1 from public.students) and (select count(*) = 1 from public.profiles)
  and (select count(*) = 1 from public.applications), 'Student retains only own private records');
select pg_temp.assert_true(not exists (select 1 from public.portal_recruiter_drive_ids())
  and not exists (select 1 from public.portal_recruiter_applicant_ids()), 'Recruiter RPCs disclose nothing to students');
select pg_temp.assert_true(exists (select 1 from storage.objects where name = pg_temp.resume_name('student_a'))
  and not exists (select 1 from storage.objects where name = pg_temp.resume_name('student_b')), 'Student resume ownership unchanged');
insert into storage.objects(bucket_id, name) values ('resumes', pg_temp.resume_name('student_a', 'student-upload.pdf'));
select pg_temp.assert_true(exists (select 1 from storage.objects where name = pg_temp.resume_name('student_a', 'student-upload.pdf')),
  'Student can still upload own resume metadata');
with changed as (update public.applications set status = 'Withdrawn' where id = pg_temp.test_id('application_a') returning id)
select pg_temp.assert_true((select id = pg_temp.test_id('application_a') from changed), 'Student withdrawal keeps the same row');
select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true(not exists (select 1 from storage.objects where name = pg_temp.resume_name('student_a')),
  'Withdrawal removes new resume authorization');
select pg_temp.login_as('student_a');
with changed as (update public.applications set status = 'Applied' where id = pg_temp.test_id('application_a') returning id)
select pg_temp.assert_true((select id = pg_temp.test_id('application_a') from changed), 'Eligible reapplication on deadline reuses row');
select pg_temp.expect_error($sql$update public.applications set status = 'Selected' where id = pg_temp.test_id('application_a')$sql$,
  'P0001', 'Student cannot select self', 'APPLICATION_STATUS_TRANSITION_DENIED:');
select pg_temp.expect_error($sql$update public.applications set status = 'Rejected' where id = pg_temp.test_id('application_a')$sql$,
  'P0001', 'Student cannot reject self', 'APPLICATION_STATUS_TRANSITION_DENIED:');
select pg_temp.expect_error($sql$insert into public.applications(student_id, drive_id)
  values (pg_temp.test_id('row_a'), pg_temp.test_id('drive_a'))$sql$, '23505', 'Unique student-drive constraint still rejects duplicates');
with changed as (update public.applications set status = 'Withdrawn' where id = pg_temp.test_id('application_b') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Student cannot withdraw another application');
select pg_temp.expect_error($sql$insert into public.applications(student_id, drive_id)
  values (pg_temp.test_id('row_b'), pg_temp.test_id('drive_a'))$sql$, '42501', 'Student cannot apply for another student');

update public.students set resume_url = 'https://example.invalid/storage/v1/object/public/resumes/' || pg_temp.resume_name('student_a')
where id = pg_temp.test_id('row_a');
select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true(exists (select 1 from storage.objects where name = pg_temp.resume_name('student_a')),
  'Legacy public URL reference authorizes a private object without publishing it');
select pg_temp.login_as('student_a');
update public.students set resume_url = 'https://example.invalid/storage/v1/object/sign/resumes/'
  || pg_temp.resume_name('student_a', 'resume%20copy.pdf') || '?token=fixture' where id = pg_temp.test_id('row_a');
select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true(exists (select 1 from storage.objects where name = pg_temp.resume_name('student_a', 'resume copy.pdf'))
  and not exists (select 1 from storage.objects where name = pg_temp.resume_name('student_a')), 'Legacy signed references resolve only their current object');
select pg_temp.login_as('student_a');
update public.students set resume_url = pg_temp.resume_name('student_a', 'new.pdf') where id = pg_temp.test_id('row_a');
select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true(exists (select 1 from storage.objects where name = pg_temp.resume_name('student_a', 'new.pdf'))
  and not exists (select 1 from storage.objects where name in (pg_temp.resume_name('student_a'), pg_temp.resume_name('student_a', 'old.pdf'))),
  'Replacement grants current file only without deleting old files');

-- Additional lifecycle regressions use a student with no applications yet.
select pg_temp.login_as('unrelated');
select pg_temp.expect_error($sql$insert into public.applications(student_id, drive_id)
  values (pg_temp.test_id('row_unrelated'), pg_temp.test_id('drive_closed'))$sql$, 'P0001', 'Initial expired deadline rejected', 'APPLICATION_DEADLINE_CLOSED:');
select pg_temp.expect_error($sql$insert into public.applications(student_id, drive_id)
  values (pg_temp.test_id('row_unrelated'), pg_temp.test_id('drive_no_deadline'))$sql$, 'P0001', 'Initial missing deadline rejected', 'APPLICATION_DEADLINE_CLOSED:');
update public.students set cgpa = 5 where id = pg_temp.test_id('row_unrelated');
select pg_temp.expect_error($sql$insert into public.applications(student_id, drive_id)
  values (pg_temp.test_id('row_unrelated'), pg_temp.test_id('drive_a'))$sql$, 'P0001', 'Initial low CGPA rejected', 'APPLICATION_NOT_ELIGIBLE:');
update public.students set cgpa = 8, branch = 'ME' where id = pg_temp.test_id('row_unrelated');
select pg_temp.expect_error($sql$insert into public.applications(student_id, drive_id)
  values (pg_temp.test_id('row_unrelated'), pg_temp.test_id('drive_a'))$sql$, 'P0001', 'Initial wrong branch rejected', 'APPLICATION_NOT_ELIGIBLE:');
update public.students set branch = 'CSE' where id = pg_temp.test_id('row_unrelated');
with inserted as (insert into public.applications(student_id, drive_id)
  values (pg_temp.test_id('row_unrelated'), pg_temp.test_id('drive_a')) returning status)
select pg_temp.assert_true((select status = 'Applied' from inserted), 'Eligible initial application on deadline starts Applied');
update public.applications set status = 'Withdrawn' where student_id = pg_temp.test_id('row_unrelated');
update public.students set cgpa = 5 where id = pg_temp.test_id('row_unrelated');
select pg_temp.expect_error($sql$update public.applications set status = 'Applied' where student_id = pg_temp.test_id('row_unrelated')$sql$,
  'P0001', 'Reapplication rechecks CGPA', 'APPLICATION_NOT_ELIGIBLE:');
update public.students set cgpa = 8, branch = 'ME' where id = pg_temp.test_id('row_unrelated');
select pg_temp.expect_error($sql$update public.applications set status = 'Applied' where student_id = pg_temp.test_id('row_unrelated')$sql$,
  'P0001', 'Reapplication rechecks branch', 'APPLICATION_NOT_ELIGIBLE:');
update public.students set branch = 'CSE' where id = pg_temp.test_id('row_unrelated');
select pg_temp.login_as('admin');
update public.placement_drives set deadline = timezone('UTC', statement_timestamp())::date - 1 where id = pg_temp.test_id('drive_a');
select pg_temp.login_as('unrelated');
select pg_temp.expect_error($sql$update public.applications set status = 'Applied' where student_id = pg_temp.test_id('row_unrelated')$sql$,
  'P0001', 'Reapplication after deadline rejected', 'APPLICATION_REAPPLY_CLOSED:');
select pg_temp.login_as('admin');
update public.placement_drives set deadline = timezone('UTC', statement_timestamp())::date where id = pg_temp.test_id('drive_a');
select pg_temp.assert_true((select count(*) = 5 from public.applications where drive_id in (pg_temp.test_id('drive_a'), pg_temp.test_id('drive_b')))
  and (select count(*) = 4 from public.students where id in (pg_temp.test_id('row_a'), pg_temp.test_id('row_b'), pg_temp.test_id('row_unrelated'), pg_temp.test_id('row_shared'))),
  'Admin retains full applicant and student management reads');
select pg_temp.assert_true(exists (select 1 from storage.objects where name = pg_temp.resume_name('student_a', 'old.pdf'))
  and exists (select 1 from storage.objects where name = pg_temp.resume_name('student_b')), 'Admin resume access unchanged');
update public.applications set status = 'Selected' where id = pg_temp.test_id('application_a');
select pg_temp.login_as('student_a');
with changed as (update public.applications set status = 'Applied' where id = pg_temp.test_id('application_a') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Student cannot reapply Selected application');
with changed as (update public.applications set status = 'Withdrawn' where id = pg_temp.test_id('application_a') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Student cannot withdraw Selected application');
select pg_temp.login_as('admin');
update public.applications set status = 'Rejected' where id = pg_temp.test_id('application_a');
select pg_temp.login_as('student_a');
with changed as (update public.applications set status = 'Applied' where id = pg_temp.test_id('application_a') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Student cannot reapply Rejected application');

-- Reassignment must revoke the previous company on the next statement.
select pg_temp.login_as('admin');
update public.recruiter_companies set company_id = pg_temp.test_id('company_b') where profile_id = pg_temp.test_id('recruiter_a');
select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true(not exists (select 1 from public.applications where id = pg_temp.test_id('application_a'))
  and not exists (select 1 from public.profiles where id = pg_temp.test_id('student_a'))
  and not exists (select 1 from storage.objects where name = pg_temp.resume_name('student_a', 'new.pdf'))
  and exists (select 1 from public.applications where id = pg_temp.test_id('application_b')), 'Admin reassignment changes applicant scope immediately');
select pg_temp.login_as('admin');
update public.recruiter_companies set company_id = pg_temp.test_id('company_a') where profile_id = pg_temp.test_id('recruiter_a');
update public.applications set status = 'Applied' where id = pg_temp.test_id('application_a');

-- Owner-only fixture corruption verifies fail-closed behavior; never live rows.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.students set resume_url = pg_temp.resume_name('student_b') where id = pg_temp.test_id('row_a');
set local role authenticated;
select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true(not public.portal_recruiter_can_read_resume(pg_temp.resume_name('student_b'))
  and not exists (select 1 from storage.objects where name = pg_temp.resume_name('student_b')), 'Forged current reference cannot authorize another owner folder');
reset role;
update public.students set profile_id = pg_temp.test_id('admin') where id = pg_temp.test_id('row_a');
set local role authenticated;
select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true(not exists (select 1 from public.students where id = pg_temp.test_id('row_a'))
  and not exists (select 1 from public.profiles where id = pg_temp.test_id('admin')), 'Corrupt non-student profile reference never exposes privileged profile');
reset role;
update public.students set profile_id = pg_temp.test_id('student_a'), resume_url = pg_temp.resume_name('student_a') where id = pg_temp.test_id('row_a');
update storage.objects set archived_at = now() where name = pg_temp.resume_name('student_a');
set local role authenticated;
select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true(not exists (select 1 from storage.objects where name = pg_temp.resume_name('student_a')), 'Archived resume metadata is not authorized');
reset role;
update storage.objects set archived_at = null where name = pg_temp.resume_name('student_a');

-- Deliberately broad test-only policies prove the restrictive boundaries survive
-- additional permissive grants. All DDL below is inside this rollback transaction.
create policy applicant_test_broad_select on public.applications for select to authenticated using (true);
create policy applicant_test_broad_update on public.applications for update to authenticated using (true) with check (true);
create policy applicant_test_broad_students on public.students for select to authenticated using (true);
create policy applicant_test_broad_student_update on public.students for update to authenticated using (true) with check (true);
create policy applicant_test_broad_profiles on public.profiles for select to authenticated using (true);
create policy applicant_test_broad_resumes on storage.objects for select to authenticated using (true);
set local role authenticated;
select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true(not exists (select 1 from public.applications where drive_id <> pg_temp.test_id('drive_a'))
  and not exists (select 1 from public.students where id = pg_temp.test_id('row_b'))
  and not exists (select 1 from public.profiles where id = pg_temp.test_id('student_b'))
  and not exists (select 1 from storage.objects where name in (pg_temp.resume_name('student_b'), pg_temp.resume_name('student_a', 'old.pdf'))),
  'Restrictive read boundaries survive broad permissive SELECT policies');
with changed as (update public.applications set status = 'Selected' where id = pg_temp.test_id('application_b') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Restrictive application scope survives permissive UPDATE');
select pg_temp.expect_error($sql$update public.applications set status = 'Withdrawn' where id = pg_temp.test_id('application_a')$sql$,
  'P0001', 'Invalid decision denied despite broad UPDATE policy', 'APPLICATION_STATUS_TRANSITION_DENIED:');
with changed as (update public.applications set status = 'Selected' where id = pg_temp.test_id('application_a') returning id)
select pg_temp.assert_true((select count(*) = 1 from changed), 'Valid decision works with broad permissive policy');
with changed as (update public.applications set status = 'Rejected' where id = pg_temp.test_id('application_a') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Terminal decision boundary survives broad permissive policy');
with changed as (update public.students set cgpa = 10 where id = pg_temp.test_id('row_a') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Restrictive student write denial survives permissive UPDATE');
reset role;

-- Temporary broader column grants prove the trigger also protects row identity.
select pg_temp.login_as('admin');
update public.applications set status = 'Applied' where id = pg_temp.test_id('application_a');
grant update (student_id, drive_id, id, applied_at) on public.applications to authenticated;
set local role authenticated;
select pg_temp.login_as('recruiter_a');
select pg_temp.expect_error($sql$update public.applications set status = 'Selected', student_id = pg_temp.test_id('row_shared')
  where id = pg_temp.test_id('application_a')$sql$, '42501', 'Trigger rejects applicant identity tampering', 'APPLICATION_STATUS_TRANSITION_DENIED:');
select pg_temp.expect_error($sql$update public.applications set status = 'Selected', drive_id = pg_temp.test_id('drive_b')
  where id = pg_temp.test_id('application_a')$sql$, '42501', 'Trigger rejects drive tampering', 'APPLICATION_STATUS_TRANSITION_DENIED:');
select pg_temp.expect_error($sql$update public.applications set applied_at = applied_at + interval '1 day'
  where id = pg_temp.test_id('application_a')$sql$, '42501', 'Trigger rejects metadata-only tampering', 'APPLICATION_STATUS_TRANSITION_DENIED:');
reset role;
revoke update (student_id, drive_id, id, applied_at) on public.applications from authenticated;
drop policy applicant_test_broad_select on public.applications;
drop policy applicant_test_broad_update on public.applications;
drop policy applicant_test_broad_students on public.students;
drop policy applicant_test_broad_student_update on public.students;
drop policy applicant_test_broad_profiles on public.profiles;
drop policy applicant_test_broad_resumes on storage.objects;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.expect_error('select * from public.applications', '42501', 'Anonymous applications denied');
select pg_temp.expect_error('update public.applications set status = ''Selected''', '42501', 'Anonymous decisions denied');
select pg_temp.expect_error('select * from public.students', '42501', 'Anonymous students denied');
select pg_temp.expect_error('select * from public.profiles', '42501', 'Anonymous profiles denied');
select pg_temp.assert_true(not exists (select 1 from storage.objects where bucket_id = 'resumes'), 'Anonymous private resumes hidden');
select pg_temp.expect_error('select public.portal_recruiter_drive_ids()', '42501', 'Anonymous recruiter drive RPC denied');
select pg_temp.expect_error('select * from public.portal_recruiter_applicant_ids()', '42501', 'Anonymous applicant RPC denied');
select pg_temp.expect_error('select public.portal_recruiter_can_read_resume(''private/path'')', '42501', 'Anonymous resume helper denied');
reset role;
set constraints all immediate;
select test, passed from applicant_test_results order by test;
rollback;
