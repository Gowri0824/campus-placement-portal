-- Auth fixtures are inserted only inside this rollback-only SQL transaction.
-- No Auth API call, invitation email, or persistent test account is created.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
create temporary table invite_ids(name text primary key, id uuid default gen_random_uuid());
insert into invite_ids(name) values ('admin'), ('student'), ('recruiter'), ('company'), ('other_company'), ('pending'), ('request'), ('missing');
create temporary table invite_results(label text);
grant select on invite_ids to authenticated, anon, service_role;
grant insert, select on invite_results to authenticated, anon, service_role;
create function pg_temp.id(name text) returns uuid language sql as 'select id from pg_temp.invite_ids where name = $1';
create function pg_temp.check_true(value boolean, label text) returns void language plpgsql as $test$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into pg_temp.invite_results values(label);
end
$test$;
create function pg_temp.denied(statement text, code text, label text) returns void language plpgsql as $test$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate <> code then raise exception 'FAIL: %, expected %, received %: %', label, code, sqlstate, sqlerrm; end if;
    insert into pg_temp.invite_results values(label);
    return;
  end;
  raise exception 'FAIL: % unexpectedly succeeded', label;
end
$test$;
create function pg_temp.login(actor text) returns void language plpgsql as $test$
begin
  perform set_config('request.jwt.claim.sub', pg_temp.id(actor)::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id(actor), 'role', 'authenticated')::text, true);
end
$test$;

insert into public.companies(id, company_name) values
  (pg_temp.id('company'), 'Rollback invite company'), (pg_temp.id('other_company'), 'Rollback other company');
insert into public.profiles(id, full_name, email, role)
select id, 'Rollback fixture', id::text || '@example.invalid', name from invite_ids where name in ('admin', 'student', 'recruiter');
insert into public.recruiter_companies values(pg_temp.id('recruiter'), pg_temp.id('company'));
set constraints all immediate;
set constraints all deferred;
insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values(pg_temp.id('pending'), 'authenticated', 'authenticated', pg_temp.id('pending')::text || '@example.invalid',
  jsonb_build_object('portal_recruiter_invite', pg_temp.id('request'), 'portal_recruiter_company', pg_temp.id('company')),
  '{}'::jsonb, now(), now());

set local role anon;
select pg_temp.denied($q$select public.portal_recruiter_invite_target(pg_temp.id('admin'), 'fresh@example.invalid', pg_temp.id('company'))$q$, '42501', 'Anonymous cannot access provisioning lookup');
set local role authenticated;
select pg_temp.login('student');
select pg_temp.denied($q$select public.portal_provision_recruiter(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('request'), 'Name', pg_temp.id('pending')::text || '@example.invalid', pg_temp.id('company'))$q$, '42501', 'Student cannot invoke provisioning, even with a forged admin ID');
select pg_temp.denied($q$insert into public.profiles(id, role) values(auth.uid(), 'admin')$q$, '42501', 'Public signup cannot assign admin');
select pg_temp.login('recruiter');
select pg_temp.denied($q$select public.portal_recruiter_invite_target(pg_temp.id('admin'), 'fresh@example.invalid', pg_temp.id('company'))$q$, '42501', 'Recruiter cannot invoke provisioning lookup');
select pg_temp.denied($q$insert into public.recruiter_companies values(auth.uid(), pg_temp.id('other_company'))$q$, '42501', 'Recruiter cannot self-assign company');
with changed as (update public.recruiter_companies set company_id = pg_temp.id('other_company') where profile_id = auth.uid() returning *)
select pg_temp.check_true((select count(*) = 0 from changed), 'Recruiter cannot reassign company');
select pg_temp.login('admin');
select pg_temp.denied($q$select public.portal_recruiter_invite_target(auth.uid(), 'fresh@example.invalid', pg_temp.id('company'))$q$, '42501', 'Even Admin browser cannot bypass the Edge Function RPC boundary');

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select pg_temp.denied($q$select public.portal_recruiter_invite_target(pg_temp.id('student'), 'fresh@example.invalid', pg_temp.id('company'))$q$, '42501', 'Server RPC independently requires a live admin actor');
select pg_temp.denied($q$select public.portal_recruiter_invite_target(pg_temp.id('admin'), 'fresh@example.invalid', pg_temp.id('missing'))$q$, '23503', 'Missing company rejected');
select pg_temp.denied($q$select public.portal_recruiter_invite_target(pg_temp.id('admin'), pg_temp.id('student')::text || '@example.invalid', pg_temp.id('company'))$q$, '23505', 'Existing student profile email cannot be converted');
select pg_temp.denied($q$select public.portal_provision_recruiter(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('missing'), 'Name', pg_temp.id('pending')::text || '@example.invalid', pg_temp.id('company'))$q$, '42501', 'Mismatched provisioning marker rejected');
select pg_temp.check_true(not exists(select 1 from public.profiles where id = pg_temp.id('pending')), 'Failed provisioning leaves no profile');
select pg_temp.check_true(not exists(select 1 from public.recruiter_companies where profile_id = pg_temp.id('pending')), 'Failed provisioning leaves no assignment');
reset role;
create function pg_temp.reject_fixture_assignment() returns trigger language plpgsql as $test$
begin
  if new.profile_id = pg_temp.id('pending') then raise exception using errcode = '23514', message = 'Simulated assignment failure'; end if;
  return new;
end
$test$;
create trigger invitation_test_assignment_failure before insert on public.recruiter_companies
for each row execute function pg_temp.reject_fixture_assignment();
set local role service_role;
select pg_temp.denied($q$select public.portal_provision_recruiter(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('request'), 'Name', pg_temp.id('pending')::text || '@example.invalid', pg_temp.id('company'))$q$, '23514', 'Failure of assignment insert rolls back the profile insert');
select pg_temp.check_true(not exists(select 1 from public.profiles where id = pg_temp.id('pending')), 'Atomic rollback removes the intermediate profile');
reset role;
drop trigger invitation_test_assignment_failure on public.recruiter_companies;
set local role service_role;
select pg_temp.check_true(public.portal_provision_recruiter(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('request'), 'Invite Fixture', pg_temp.id('pending')::text || '@example.invalid', pg_temp.id('company')) = pg_temp.id('pending'), 'Admin-authorized server provisions recruiter');
set constraints all immediate;
set constraints all deferred;
select pg_temp.check_true((select role = 'recruiter' and full_name = 'Invite Fixture' from public.profiles where id = pg_temp.id('pending')), 'Recruiter profile has expected role and details');
select pg_temp.check_true((select company_id = pg_temp.id('company') from public.recruiter_companies where profile_id = pg_temp.id('pending')), 'Recruiter assigned exactly one intended company');
select pg_temp.check_true(public.portal_provision_recruiter(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('request'), 'Do not overwrite', pg_temp.id('pending')::text || '@example.invalid', pg_temp.id('company')) = pg_temp.id('pending'), 'Provisioning retry reuses the same identity');
select pg_temp.check_true((select full_name = 'Invite Fixture' from public.profiles where id = pg_temp.id('pending')), 'Retry does not overwrite existing profile details');
select pg_temp.denied($q$select public.portal_recruiter_invite_target(pg_temp.id('admin'), pg_temp.id('pending')::text || '@example.invalid', pg_temp.id('other_company'))$q$, '23505', 'Retry cannot reassign to another company');

reset role;
-- Simulate an active account without sending mail or using Auth APIs.
update auth.users set email_confirmed_at = now() where id = pg_temp.id('pending');
set local role service_role;
select pg_temp.denied($q$select public.portal_recruiter_invite_target(pg_temp.id('admin'), pg_temp.id('pending')::text || '@example.invalid', pg_temp.id('company'))$q$, '23505', 'Confirmed account cannot be reinvited through provisioning');
reset role;
set local role authenticated;
select pg_temp.login('pending');
select pg_temp.check_true((select count(*) = 1 from public.companies), 'Provisioned recruiter sees only its company under RLS');
select pg_temp.check_true((select count(*) = 1 from public.recruiter_companies), 'Provisioned recruiter reads only its own assignment');
select pg_temp.denied($q$update public.profiles set role = 'admin' where id = auth.uid()$q$, '42501', 'Provisioned recruiter cannot elevate role');
reset role;
select jsonb_build_object('passed', count(*), 'assertions', jsonb_agg(label)) as verification from invite_results;
rollback;
