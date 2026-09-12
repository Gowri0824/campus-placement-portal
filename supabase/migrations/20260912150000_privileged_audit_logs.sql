-- Append-only client access. Existing application and recruiter authorization stays intact.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.audit_logs') is not null
    or (select md5(prosrc) from pg_proc where oid =
      'public.portal_provision_recruiter(uuid,uuid,uuid,text,text,uuid)'::regprocedure)
      is distinct from 'ff48b2539e2f5448435e2638643ea3dd'
    or not exists (select 1 from pg_trigger where tgrelid = 'public.applications'::regclass
      and tgname = 'applications_enforce_recruiter_decision_before_update' and tgenabled = 'O') then
    raise exception 'Audit/provisioning schema differs from the inspected baseline; review before applying';
  end if;
end
$preflight$;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- Historical references intentionally have no FK: no cascades or new deletion restrictions.
  actor_profile_id uuid not null,
  actor_role text not null check (actor_role in ('admin', 'recruiter')),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  old_status text,
  new_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint audit_logs_event_shape check (
    (action = 'application.status_changed' and entity_type = 'application'
      and old_status is not null and new_status is not null and old_status <> new_status
      and old_status in ('Applied', 'Selected', 'Rejected', 'Withdrawn')
      and new_status in ('Applied', 'Selected', 'Rejected', 'Withdrawn')
      and jsonb_typeof(metadata) = 'object' and metadata - 'drive_id' = '{}'::jsonb)
    or (action in ('recruiter.provisioned', 'recruiter.invitation_requested')
      and entity_type = 'recruiter' and actor_role = 'admin'
      and old_status is null and new_status is null
      and jsonb_typeof(metadata) = 'object' and metadata ? 'company_id'
      and metadata - 'company_id' = '{}'::jsonb)
  )
);
alter table public.audit_logs owner to postgres;
create index audit_logs_created_at_idx on public.audit_logs(created_at desc, id desc);
create index audit_logs_action_created_at_idx on public.audit_logs(action, created_at desc, id desc);
create index audit_logs_role_created_at_idx on public.audit_logs(actor_role, created_at desc, id desc);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public, anon, authenticated, service_role;
grant select on public.audit_logs to authenticated;
create policy "Admins read audit logs" on public.audit_logs for select to authenticated
  using (public.portal_has_role(array['admin']::text[]));

create function public.portal_audit_application_status()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  actor_role text;
begin
  select role into actor_role from public.profiles where id = actor_id;
  if actor_role in ('admin', 'recruiter') then
    insert into public.audit_logs(actor_profile_id, actor_role, action, entity_type,
      entity_id, old_status, new_status, metadata)
    values(actor_id, actor_role, 'application.status_changed', 'application',
      new.id, old.status, new.status, jsonb_build_object('drive_id', new.drive_id));
  end if;
  return new;
end
$function$;
alter function public.portal_audit_application_status() owner to postgres;
revoke all on function public.portal_audit_application_status() from public, anon, authenticated, service_role;
create trigger applications_audit_status_after_update after update of status on public.applications
  for each row when (old.status is distinct from new.status)
  execute function public.portal_audit_application_status();

create or replace function public.portal_provision_recruiter(
  p_admin_id uuid, p_user_id uuid, p_request_id uuid,
  p_full_name text, p_email text, p_company_id uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  target auth.users%rowtype;
  profile public.profiles%rowtype;
  assigned_company uuid;
begin
  -- Re-check the live administrator and company even after the Edge preflight.
  perform public.portal_recruiter_invite_target(p_admin_id, p_email, p_company_id);
  if p_full_name is null or length(btrim(p_full_name)) not between 1 and 120
    or p_full_name ~ '[[:cntrl:]]' or p_request_id is null then
    raise exception using errcode = '22023', message = 'Invalid recruiter details.';
  end if;
  select * into target from auth.users where id = p_user_id for update;
  if not found or lower(target.email) is distinct from p_email
    or target.email_confirmed_at is not null or target.last_sign_in_at is not null
    or (target.raw_app_meta_data->>'portal_recruiter_invite') is distinct from p_request_id::text
    or (target.raw_app_meta_data->>'portal_recruiter_company') is distinct from p_company_id::text then
    raise exception using errcode = '42501', message = 'Auth account does not match this pending recruiter invitation.';
  end if;
  select * into profile from public.profiles where id = p_user_id for update;
  select company_id into assigned_company from public.recruiter_companies where profile_id = p_user_id;
  if profile.id is not null then
    if profile.role = 'recruiter' and lower(profile.email) = p_email and assigned_company = p_company_id then
      return p_user_id; -- Retry does not create a second provisioning event.
    end if;
    raise exception using errcode = '23505', message = 'An incompatible profile already exists.';
  end if;
  insert into public.profiles(id, full_name, email, role)
    values (p_user_id, btrim(p_full_name), p_email, 'recruiter');
  insert into public.recruiter_companies(profile_id, company_id) values (p_user_id, p_company_id);
  insert into public.audit_logs(actor_profile_id, actor_role, action, entity_type, entity_id, metadata)
    values(p_admin_id, 'admin', 'recruiter.provisioned', 'recruiter', p_user_id,
      jsonb_build_object('company_id', p_company_id));
  -- The existing deferred triggers validate exactly-one membership at commit.
  return p_user_id;
end
$function$;
alter function public.portal_provision_recruiter(uuid, uuid, uuid, text, text, uuid) owner to postgres;
revoke all on function public.portal_provision_recruiter(uuid, uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.portal_provision_recruiter(uuid, uuid, uuid, text, text, uuid) to service_role;

-- Write-ahead invitation intent, not an email-delivery receipt. Only the Edge can call this.
create function public.portal_audit_recruiter_invitation(
  p_admin_id uuid, p_user_id uuid, p_company_id uuid, p_attempt_id uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  target_email text;
  target jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Server-side invitation auditing only.';
  end if;
  if p_attempt_id is null then
    raise exception using errcode = '22023', message = 'Invitation attempt ID required.';
  end if;
  select email into target_email from auth.users where id = p_user_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Pending recruiter account required.';
  end if;
  target := public.portal_recruiter_invite_target(p_admin_id, lower(target_email), p_company_id);
  if (target->>'user_id') is distinct from p_user_id::text
    or not exists(select 1 from public.profiles p join public.recruiter_companies rc on rc.profile_id = p.id
      where p.id = p_user_id and p.role = 'recruiter' and rc.company_id = p_company_id) then
    raise exception using errcode = '42501', message = 'Provisioned recruiter and matching company required.';
  end if;
  insert into public.audit_logs(id, actor_profile_id, actor_role, action, entity_type, entity_id, metadata)
    values(p_attempt_id, p_admin_id, 'admin', 'recruiter.invitation_requested', 'recruiter', p_user_id,
      jsonb_build_object('company_id', p_company_id)) on conflict (id) do nothing;
  if not exists(select 1 from public.audit_logs where id = p_attempt_id and actor_profile_id = p_admin_id
    and action = 'recruiter.invitation_requested' and entity_id = p_user_id
    and metadata = jsonb_build_object('company_id', p_company_id)) then
    raise exception using errcode = '23505', message = 'Invitation audit ID conflicts with an existing event.';
  end if;
  return p_attempt_id;
end
$function$;
alter function public.portal_audit_recruiter_invitation(uuid, uuid, uuid, uuid) owner to postgres;
revoke all on function public.portal_audit_recruiter_invitation(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.portal_audit_recruiter_invitation(uuid, uuid, uuid, uuid) to service_role;
notify pgrst, 'reload schema';
commit;
