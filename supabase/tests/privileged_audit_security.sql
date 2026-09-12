-- All fixtures, including Auth rows and simulated failures, roll back. No email or Storage API.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
create temporary table audit_ids(name text primary key, id uuid default gen_random_uuid());
insert into audit_ids(name) values ('admin'), ('recruiter'), ('student'), ('company'), ('other_company'),
  ('drive'), ('other_drive'), ('row'), ('a'), ('b'), ('c'), ('d'), ('other'),
  ('pending'), ('request'), ('attempt'), ('missing');
create temporary table audit_results(label text);
grant select on audit_ids to authenticated, anon, service_role;
grant insert, select on audit_results to authenticated, anon, service_role;
create function pg_temp.id(name text) returns uuid language sql as 'select id from pg_temp.audit_ids where name = $1';
create function pg_temp.check_true(value boolean, label text) returns void language plpgsql as $test$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into pg_temp.audit_results values(label);
end
$test$;
create function pg_temp.denied(statement text, code text, label text) returns void language plpgsql as $test$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate <> code then raise exception 'FAIL: %, expected %, received %: %', label, code, sqlstate, sqlerrm; end if;
    insert into pg_temp.audit_results values(label);
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

insert into public.profiles(id, full_name, email, role)
select id, 'Rollback audit fixture', id::text || '@example.invalid', name from audit_ids where name in ('admin', 'student', 'recruiter');
insert into public.companies(id, company_name) values
  (pg_temp.id('company'), 'Rollback audit company'), (pg_temp.id('other_company'), 'Rollback other audit company');
insert into public.recruiter_companies values(pg_temp.id('recruiter'), pg_temp.id('company'));
insert into public.placement_drives(id, company_id, role, deadline, min_cgpa, allowed_branches)
select pg_temp.id(name), pg_temp.id(case when name = 'other_drive' then 'other_company' else 'company' end),
  'Rollback audit role', timezone('UTC', statement_timestamp())::date + 1, 6, 'CSE'
from (values ('drive'), ('other_drive'), ('a'), ('b'), ('c')) f(name);
insert into public.students(id, profile_id, branch, cgpa) values(pg_temp.id('row'), pg_temp.id('student'), 'cse', 8);
insert into public.applications(id, student_id, drive_id)
select pg_temp.id(name), pg_temp.id('row'), pg_temp.id(case when name = 'other' then 'other_drive'
  when name = 'd' then 'drive' else name end) from (values ('a'), ('b'), ('c'), ('d'), ('other')) f(name);
insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values(pg_temp.id('pending'), 'authenticated', 'authenticated', pg_temp.id('pending')::text || '@example.invalid',
  jsonb_build_object('portal_recruiter_invite', pg_temp.id('request'), 'portal_recruiter_company', pg_temp.id('company')),
  '{}'::jsonb, now(), now());
set constraints all immediate;
set constraints all deferred;

select pg_temp.check_true((select relrowsecurity from pg_class where oid = 'public.audit_logs'::regclass), 'Audit RLS enabled');
select pg_temp.check_true(not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT,UPDATE,DELETE,TRUNCATE')
  and not has_table_privilege('service_role', 'public.audit_logs', 'INSERT,UPDATE,DELETE,TRUNCATE'), 'Clients and service key lack direct audit write grants');
set local role authenticated;
select pg_temp.login('admin');
select pg_temp.check_true(not (select rolbypassrls or rolsuper from pg_roles where rolname = current_user), 'Role assertions do not bypass RLS');
update public.applications set status = 'Selected' where id = pg_temp.id('a');
select pg_temp.check_true((select count(*) = 1 from public.audit_logs where entity_id = pg_temp.id('a')
  and actor_profile_id = auth.uid() and actor_role = 'admin' and old_status = 'Applied' and new_status = 'Selected'
  and metadata = jsonb_build_object('drive_id', pg_temp.id('a'))), 'Admin status change creates an accurate atomic event');
update public.applications set status = 'Selected' where id = pg_temp.id('a');
select pg_temp.check_true((select count(*) = 1 from public.audit_logs where entity_id = pg_temp.id('a')), 'Admin no-op creates no duplicate event');
select pg_temp.denied($q$update public.applications set status = 'Invalid' where id = pg_temp.id('a')$q$, '42501', 'Invalid status rejected by existing RLS');

select pg_temp.login('recruiter');
update public.applications set status = 'Selected' where id = pg_temp.id('b');
update public.applications set status = 'Rejected' where id = pg_temp.id('c');
with changed as (update public.applications set status = 'Selected' where id = pg_temp.id('other') returning *)
select pg_temp.check_true(not exists(select 1 from changed), 'Cross-company decision denied');
with changed as (update public.applications set status = 'Rejected' where id = pg_temp.id('b') returning *)
select pg_temp.check_true(not exists(select 1 from changed), 'Terminal recruiter decision denied');
select pg_temp.denied($q$update public.applications set status = 'Withdrawn' where id = pg_temp.id('d')$q$, 'P0001', 'Recruiter cannot withdraw');
select pg_temp.check_true((select count(*) = 0 from public.audit_logs), 'Recruiter cannot read even own audit events');
select pg_temp.denied($q$insert into public.applications(student_id, drive_id) values(pg_temp.id('row'), pg_temp.id('drive'))$q$, '42501', 'Recruiter cannot insert applications');
select pg_temp.denied($q$delete from public.applications where id = pg_temp.id('b')$q$, '42501', 'Recruiter cannot delete applications');

select pg_temp.login('student');
update public.applications set status = 'Withdrawn' where id = pg_temp.id('d');
update public.applications set status = 'Applied' where id = pg_temp.id('d');
select pg_temp.check_true((select status = 'Applied' from public.applications where id = pg_temp.id('d')), 'Student withdraw/reapply still reuses its row');
select pg_temp.denied($q$update public.applications set status = 'Selected' where id = pg_temp.id('d')$q$, 'P0001', 'Student cannot promote status');
select pg_temp.check_true((select count(*) = 0 from public.audit_logs), 'Student cannot read audit logs');
-- A role in mutable user metadata never grants audit access.
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id('student'), 'role', 'authenticated',
  'user_metadata', jsonb_build_object('role', 'admin'))::text, true);
select pg_temp.check_true((select count(*) = 0 from public.audit_logs), 'Forged metadata cannot become an Admin');

do $clients$
declare actor text;
begin
  foreach actor in array array['student', 'recruiter', 'admin'] loop
    perform pg_temp.login(actor);
    perform pg_temp.denied($q$insert into public.audit_logs(actor_profile_id, actor_role, action, entity_type, entity_id)
      values(auth.uid(), 'admin', 'application.status_changed', 'application', pg_temp.id('a'))$q$, '42501', actor || ' cannot forge entries');
    perform pg_temp.denied($q$update public.audit_logs set new_status = 'Rejected'$q$, '42501', actor || ' cannot rewrite entries');
    perform pg_temp.denied($q$delete from public.audit_logs$q$, '42501', actor || ' cannot delete entries');
    perform pg_temp.denied($q$select public.portal_audit_recruiter_invitation(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('company'), pg_temp.id('attempt'))$q$,
      '42501', actor || ' cannot invoke server-only invitation audit');
  end loop;
end
$clients$;
select pg_temp.check_true((select count(*) = 3 from public.audit_logs where entity_id in (select id from audit_ids)),
  'Exactly three privileged changes: no false events for denied or student operations');
select pg_temp.check_true((select count(*) = 2 from public.audit_logs where actor_profile_id = pg_temp.id('recruiter')
  and actor_role = 'recruiter' and old_status = 'Applied' and new_status in ('Selected', 'Rejected')), 'Both recruiter decisions are audited');

set local role anon;
select pg_temp.denied('select * from public.audit_logs', '42501', 'Anonymous cannot read logs');
select pg_temp.denied($q$select public.portal_audit_recruiter_invitation(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('company'), pg_temp.id('attempt'))$q$,
  '42501', 'Anonymous cannot invoke invitation audit');
reset role;
create function pg_temp.reject_audit_fixture() returns trigger language plpgsql as $test$
begin
  if new.actor_profile_id = pg_temp.id('admin') then
    raise exception using errcode = '23514', message = 'Simulated audit failure';
  end if;
  return new;
end
$test$;
create trigger audit_fixture_failure before insert on public.audit_logs for each row execute function pg_temp.reject_audit_fixture();
set local role authenticated;
select pg_temp.login('admin');
select pg_temp.denied($q$update public.applications set status = 'Rejected' where id = pg_temp.id('a')$q$, '23514', 'Audit failure rolls back the originating status update');
select pg_temp.check_true((select status = 'Selected' from public.applications where id = pg_temp.id('a')), 'Original application state survives audit failure');
select pg_temp.check_true((select count(*) = 1 from public.audit_logs where entity_id = pg_temp.id('a')), 'Failed update leaves no success event');

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select pg_temp.denied($q$select public.portal_provision_recruiter(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('request'), 'Audit Fixture', pg_temp.id('pending')::text || '@example.invalid', pg_temp.id('company'))$q$,
  '23514', 'Audit failure atomically rolls back recruiter provisioning');
select pg_temp.check_true(not exists(select 1 from public.profiles where id = pg_temp.id('pending'))
  and not exists(select 1 from public.recruiter_companies where profile_id = pg_temp.id('pending')), 'No partial profile or association after audit failure');
reset role;
drop trigger audit_fixture_failure on public.audit_logs;
set local role service_role;
select public.portal_provision_recruiter(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('request'), 'Audit Fixture', pg_temp.id('pending')::text || '@example.invalid', pg_temp.id('company'));
select public.portal_provision_recruiter(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('request'), 'Audit Fixture', pg_temp.id('pending')::text || '@example.invalid', pg_temp.id('company'));
set constraints all immediate;
set constraints all deferred;
select pg_temp.denied($q$select public.portal_audit_recruiter_invitation(pg_temp.id('student'), pg_temp.id('pending'), pg_temp.id('company'), pg_temp.id('attempt'))$q$,
  '42501', 'Invitation audit independently verifies the live Admin actor');
select pg_temp.denied($q$select public.portal_audit_recruiter_invitation(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('other_company'), pg_temp.id('attempt'))$q$,
  '23505', 'Invitation audit cannot claim an unrelated company');
select pg_temp.check_true(public.portal_audit_recruiter_invitation(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('company'), pg_temp.id('attempt')) = pg_temp.id('attempt'), 'Validated invitation request creates an event');
select public.portal_audit_recruiter_invitation(pg_temp.id('admin'), pg_temp.id('pending'), pg_temp.id('company'), pg_temp.id('attempt'));
select pg_temp.denied($q$insert into public.audit_logs default values$q$, '42501', 'Service key cannot bypass writers to insert fake logs');
reset role;
select pg_temp.check_true((select count(*) = 1 from public.audit_logs where entity_id = pg_temp.id('pending') and action = 'recruiter.provisioned'), 'Provisioning event is atomic and idempotent');
select pg_temp.check_true((select count(*) = 1 from public.audit_logs where id = pg_temp.id('attempt')
  and action = 'recruiter.invitation_requested' and actor_profile_id = pg_temp.id('admin') and actor_role = 'admin'
  and metadata = jsonb_build_object('company_id', pg_temp.id('company'))), 'Invitation attempt is idempotent and contains only company metadata');
select pg_temp.check_true((select count(*) = 5 from public.audit_logs where entity_id in (select id from audit_ids)), 'No extra events from failed provisioning or denied invitations');
-- Explicit subtransaction rollback removes a successful mutation and its event together.
set local role authenticated;
select pg_temp.login('admin');
do $rollback_check$
begin
  begin
    update public.applications set status = 'Rejected' where id = pg_temp.id('a');
    raise exception using errcode = 'P0099', message = 'Rollback fixture';
  exception when sqlstate 'P0099' then null;
  end;
end
$rollback_check$;
select pg_temp.check_true((select count(*) = 1 from public.audit_logs where entity_id = pg_temp.id('a'))
  and (select status = 'Selected' from public.applications where id = pg_temp.id('a')), 'Outer rollback also removes an already-written event');
reset role;
select jsonb_build_object('passed', count(*), 'assertions', jsonb_agg(label)) as verification from audit_results;
rollback;
