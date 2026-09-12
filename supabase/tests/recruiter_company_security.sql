-- Run as owner with `supabase db query --linked --file <this file>`.
-- All fixture rows use fresh UUIDs. No auth users are created. ALWAYS rolls back.
-- Assertions run as authenticated/anon (NOBYPASSRLS), not as the setup owner.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

create temporary table recruiter_test_ids (name text primary key, id uuid not null default gen_random_uuid());
insert into recruiter_test_ids(name) values
  ('admin'), ('student'), ('other_student'), ('recruiter_a'), ('recruiter_b'),
  ('company_a'), ('company_b'), ('drive_a'), ('drive_b'),
  ('student_a_row'), ('student_b_row'), ('application_a'), ('application_b');
create temporary table recruiter_test_results (test text, passed boolean);
grant select on recruiter_test_ids to authenticated, anon;
grant insert, select on recruiter_test_results to authenticated, anon;

create function pg_temp.test_id(key text) returns uuid language sql as
  'select id from pg_temp.recruiter_test_ids where name = key';
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $test$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into pg_temp.recruiter_test_results values (label, true);
end
$test$;
create function pg_temp.expect_error(statement text, expected_code text, label text, check_deferred boolean default false)
returns void language plpgsql as $test$
begin
  begin
    execute statement;
    if check_deferred then set constraints all immediate; end if;
  exception when others then
    if sqlstate <> expected_code then
      raise exception 'FAIL: %, expected SQLSTATE %, received %: %', label, expected_code, sqlstate, sqlerrm;
    end if;
    insert into pg_temp.recruiter_test_results values (label, true);
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

-- Snapshot existing policy/grant semantics is checked separately by the migration
-- audit; these fixtures exercise actual table access through those policies.
insert into public.profiles(id, role, full_name, email)
select id, case when name like 'recruiter_%' then 'recruiter'
  when name = 'admin' then 'admin' else 'student' end,
  'Rollback-only security fixture', id::text || '@example.invalid'
from recruiter_test_ids where name in ('admin', 'student', 'other_student', 'recruiter_a', 'recruiter_b');
insert into public.companies(id, company_name) values
  (pg_temp.test_id('company_a'), 'Rollback-only company A'),
  (pg_temp.test_id('company_b'), 'Rollback-only company B');
insert into public.placement_drives(id, company_id, role, deadline, min_cgpa, allowed_branches) values
  (pg_temp.test_id('drive_a'), pg_temp.test_id('company_a'), 'Rollback-only role A', (timezone('UTC', now()))::date + 1, 6, 'CSE'),
  (pg_temp.test_id('drive_b'), pg_temp.test_id('company_b'), 'Rollback-only role B', (timezone('UTC', now()))::date + 1, 6, 'CSE');
insert into public.students(id, profile_id, branch, cgpa) values
  (pg_temp.test_id('student_a_row'), pg_temp.test_id('student'), 'CSE', 8),
  (pg_temp.test_id('student_b_row'), pg_temp.test_id('other_student'), 'CSE', 8);
insert into public.applications(id, student_id, drive_id, status) values
  (pg_temp.test_id('application_a'), pg_temp.test_id('student_a_row'), pg_temp.test_id('drive_a'), 'Applied'),
  (pg_temp.test_id('application_b'), pg_temp.test_id('student_b_row'), pg_temp.test_id('drive_b'), 'Applied');

set local role authenticated;
select pg_temp.login_as('admin');
select pg_temp.assert_true(current_user = 'authenticated' and not
  (select rolbypassrls or rolsuper from pg_roles where rolname = current_user), 'Tests use a non-bypass authenticated role');
insert into public.recruiter_companies(profile_id, company_id) values
  (pg_temp.test_id('recruiter_a'), pg_temp.test_id('company_a')),
  (pg_temp.test_id('recruiter_b'), pg_temp.test_id('company_b'));
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_true((select count(*) = 2 from public.recruiter_companies
  where profile_id in (pg_temp.test_id('recruiter_a'), pg_temp.test_id('recruiter_b'))),
  'Admin creates and reads both fixture assignments');
with changed as (
  update public.recruiter_companies set company_id = pg_temp.test_id('company_a')
  where profile_id = pg_temp.test_id('recruiter_b') returning company_id
) select pg_temp.assert_true((select count(*) = 1 from changed), 'Admin can reassign company');
update public.recruiter_companies set company_id = pg_temp.test_id('company_b')
where profile_id = pg_temp.test_id('recruiter_b');
with removed as (
  delete from public.recruiter_companies where profile_id = pg_temp.test_id('recruiter_b') returning profile_id
) select pg_temp.assert_true((select count(*) = 1 from removed), 'Admin can remove assignment within a reassignment transaction');
insert into public.recruiter_companies values (pg_temp.test_id('recruiter_b'), pg_temp.test_id('company_b'));
select pg_temp.expect_error($sql$insert into public.recruiter_companies values
  (pg_temp.test_id('recruiter_a'), pg_temp.test_id('company_b'))$sql$, '23505', 'Duplicate membership rejected');
select pg_temp.expect_error($sql$insert into public.recruiter_companies values
  (pg_temp.test_id('student'), pg_temp.test_id('company_a'))$sql$, '23514', 'Student profile cannot be assigned as recruiter');
select pg_temp.expect_error($sql$update public.recruiter_companies set company_id = gen_random_uuid()
  where profile_id = pg_temp.test_id('recruiter_a')$sql$, '23503', 'Missing company rejected by FK');
select pg_temp.expect_error($sql$update public.recruiter_companies set company_id = null
  where profile_id = pg_temp.test_id('recruiter_a')$sql$, '23502', 'Null company rejected');
select pg_temp.expect_error($sql$delete from public.recruiter_companies
  where profile_id = pg_temp.test_id('recruiter_a')$sql$, '23514', 'Recruiter cannot be left unassigned at commit', true);

select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true((select count(*) = 1 from public.recruiter_companies)
  and (select company_id = pg_temp.test_id('company_a') from public.recruiter_companies), 'Recruiter sees only own assignment');
select pg_temp.assert_true(public.portal_recruiter_company_id() = pg_temp.test_id('company_a'), 'Company helper resolves authenticated recruiter');
select pg_temp.assert_true((select count(*) = 1 from public.companies)
  and exists (select 1 from public.companies where id = pg_temp.test_id('company_a')), 'Recruiter sees only own company');
select pg_temp.assert_true(not exists (select 1 from public.companies where id = pg_temp.test_id('company_b')), 'Other company hidden');
select pg_temp.assert_true((select count(*) = 1 from public.placement_drives)
  and exists (select 1 from public.placement_drives where id = pg_temp.test_id('drive_a')), 'Recruiter sees only own company drive');
select pg_temp.assert_true(not exists (select 1 from public.placement_drives where id = pg_temp.test_id('drive_b')), 'Other company drive hidden');
-- This company-boundary suite works before and after applicant reads are enabled.
-- Positive applicant access is asserted by recruiter_applicant_security.sql.
select pg_temp.assert_true(not exists (select 1 from public.students where id <> pg_temp.test_id('student_a_row')),
  'Recruiter cannot browse unrelated students');
select pg_temp.assert_true(not exists (select 1 from public.applications where id <> pg_temp.test_id('application_a')),
  'Recruiter cannot read unrelated applications');
select pg_temp.assert_true(not exists (select 1 from public.profiles
  where id not in (pg_temp.test_id('recruiter_a'), pg_temp.test_id('student')))
  and exists (select 1 from public.profiles where id = pg_temp.test_id('recruiter_a')), 'Recruiter profile scope excludes unrelated people');
select pg_temp.expect_error($sql$insert into public.recruiter_companies values
  (pg_temp.test_id('recruiter_a'), pg_temp.test_id('company_b'))$sql$, '42501', 'Recruiter cannot self-assign');
with changed as (
  update public.recruiter_companies set company_id = pg_temp.test_id('company_b')
  where profile_id = pg_temp.test_id('recruiter_a') returning profile_id
) select pg_temp.assert_true(not exists (select 1 from changed), 'Recruiter cannot change own assignment');
with removed as (
  delete from public.recruiter_companies where profile_id = pg_temp.test_id('recruiter_a') returning profile_id
) select pg_temp.assert_true(not exists (select 1 from removed), 'Recruiter cannot delete own assignment');
with changed as (
  update public.recruiter_companies set company_id = pg_temp.test_id('company_a')
  where profile_id = pg_temp.test_id('recruiter_b') returning profile_id
) select pg_temp.assert_true(not exists (select 1 from changed), 'Recruiter cannot change another assignment');
select pg_temp.expect_error($sql$insert into public.companies(company_name) values ('Must not persist')$sql$, '42501', 'Recruiter cannot create companies');
select pg_temp.expect_error($sql$insert into public.placement_drives(company_id, role)
  values (pg_temp.test_id('company_a'), 'Must not persist')$sql$, '42501', 'Recruiter cannot create drives');
with changed as (update public.companies set company_name = 'Denied' where id = pg_temp.test_id('company_a') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Recruiter cannot update own company');
with removed as (delete from public.companies where id = pg_temp.test_id('company_a') returning id)
select pg_temp.assert_true(not exists (select 1 from removed), 'Recruiter cannot delete own company');
with changed as (update public.placement_drives set role = 'Denied' where id = pg_temp.test_id('drive_a') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Recruiter cannot update drives');
with removed as (delete from public.placement_drives where id = pg_temp.test_id('drive_a') returning id)
select pg_temp.assert_true(not exists (select 1 from removed), 'Recruiter cannot delete drives');
with changed as (update public.applications set status = 'Selected' where id = pg_temp.test_id('application_b') returning id)
select pg_temp.assert_true(not exists (select 1 from changed), 'Recruiter cannot select another company applicant');
select pg_temp.expect_error($sql$update public.profiles set role = 'admin'
  where id = pg_temp.test_id('recruiter_a')$sql$, '42501', 'Recruiter cannot self-promote');

select pg_temp.login_as('recruiter_b');
select pg_temp.assert_true((select count(*) = 1 from public.companies)
  and exists (select 1 from public.companies where id = pg_temp.test_id('company_b'))
  and (select count(*) = 1 from public.placement_drives)
  and exists (select 1 from public.placement_drives where id = pg_temp.test_id('drive_b')), 'Second recruiter has independent company scope');

select pg_temp.login_as('student');
select pg_temp.assert_true(public.portal_recruiter_company_id() is null
  and not exists (select 1 from public.recruiter_companies), 'Student cannot resolve or read memberships');
select pg_temp.assert_true((select count(*) = 2 from public.companies where id in (pg_temp.test_id('company_a'), pg_temp.test_id('company_b')))
  and (select count(*) = 2 from public.placement_drives where id in (pg_temp.test_id('drive_a'), pg_temp.test_id('drive_b'))), 'Student retains both company and drive reads');
select pg_temp.assert_true((select count(*) = 1 from public.students)
  and exists (select 1 from public.students where id = pg_temp.test_id('student_a_row')), 'Student retains own-record privacy');
with changed as (update public.profiles set full_name = 'Rollback-only updated name'
  where id = pg_temp.test_id('student') returning id)
select pg_temp.assert_true((select count(*) = 1 from changed), 'Student profile edit still works');
select pg_temp.expect_error($sql$insert into public.applications(student_id, drive_id, status)
  values (pg_temp.test_id('student_a_row'), pg_temp.test_id('drive_a'), 'Applied')$sql$, '23505', 'Application uniqueness preserved');
with changed as (update public.applications set status = 'Withdrawn' where id = pg_temp.test_id('application_a') returning status)
select pg_temp.assert_true((select status = 'Withdrawn' from changed), 'Student withdrawal preserved');
with changed as (update public.applications set status = 'Applied' where id = pg_temp.test_id('application_a') returning id)
select pg_temp.assert_true((select id = pg_temp.test_id('application_a') from changed), 'Student eligible reapplication reuses same row');

select pg_temp.login_as('admin');
select pg_temp.assert_true((select count(*) = 2 from public.students where id in (pg_temp.test_id('student_a_row'), pg_temp.test_id('student_b_row')))
  and (select count(*) = 2 from public.applications where id in (pg_temp.test_id('application_a'), pg_temp.test_id('application_b'))), 'Admin retains student and application reads');
with changed as (update public.applications set status = 'Selected' where id = pg_temp.test_id('application_a') returning status)
select pg_temp.assert_true((select status = 'Selected' from changed), 'Admin selection update preserved');

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
select pg_temp.expect_error($sql$insert into public.profiles(id, role) values (gen_random_uuid(), 'recruiter')$sql$,
  '23514', 'New recruiter requires company in the same transaction', true);
select pg_temp.expect_error($sql$update public.profiles set role = 'student'
  where id = pg_temp.test_id('recruiter_a')$sql$, '23514', 'Role demotion requires membership removal', true);
select pg_temp.expect_error($sql$delete from public.profiles where id = pg_temp.test_id('recruiter_a')$sql$,
  '23503', 'Profile deletion is restricted while assigned');
select pg_temp.expect_error($sql$delete from public.companies where id = pg_temp.test_id('company_a')$sql$,
  '23503', 'Company deletion is restricted while referenced');

-- Deliberately add permissive policies within this rollback transaction to prove
-- the restrictive boundaries cannot be widened by another SELECT policy.
create policy recruiter_test_broad_companies on public.companies for select to authenticated using (true);
create policy recruiter_test_broad_drives on public.placement_drives for select to authenticated using (true);
create policy recruiter_test_broad_students on public.students for select to authenticated using (true);
create policy recruiter_test_broad_applications on public.applications for select to authenticated using (true);
set local role authenticated;
select pg_temp.login_as('recruiter_a');
select pg_temp.assert_true((select count(*) = 1 from public.companies)
  and (select count(*) = 1 from public.placement_drives)
  and not exists (select 1 from public.students where id <> pg_temp.test_id('student_a_row'))
  and not exists (select 1 from public.applications where id <> pg_temp.test_id('application_a')),
  'Restrictive boundaries survive additional permissive SELECT policies');
reset role;
drop policy recruiter_test_broad_companies on public.companies;
drop policy recruiter_test_broad_drives on public.placement_drives;
drop policy recruiter_test_broad_students on public.students;
drop policy recruiter_test_broad_applications on public.applications;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.expect_error('select * from public.recruiter_companies', '42501', 'Anonymous membership read denied');
select pg_temp.expect_error('select * from public.companies', '42501', 'Anonymous company read denied');
select pg_temp.expect_error('select * from public.placement_drives', '42501', 'Anonymous drive read denied');
select pg_temp.expect_error('select public.portal_recruiter_company_id()', '42501', 'Anonymous helper execution denied');
reset role;
set constraints all immediate;
select test, passed from recruiter_test_results order by test;
rollback;
