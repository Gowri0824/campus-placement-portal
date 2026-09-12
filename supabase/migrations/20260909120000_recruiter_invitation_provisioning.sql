-- Trusted Edge Function entry points only; existing grants, RLS and triggers stay intact.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regprocedure('public.portal_require_recruiter_company()') is null
    or not exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass
      and tgname = 'profiles_require_recruiter_company' and tgdeferrable and tginitdeferred)
    or exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal) then
    raise exception 'Recruiter integrity/auth triggers differ from the inspected schema; review before provisioning';
  end if;
end
$preflight$;

create function public.portal_recruiter_invite_target(p_admin_id uuid, p_email text, p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  target auth.users%rowtype;
  profile public.profiles%rowtype;
  assigned_company uuid;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Server-side provisioning only.';
  end if;
  perform 1 from public.profiles where id = p_admin_id and role = 'admin' for share;
  if not found then
    raise exception using errcode = '42501', message = 'Administrator authorization required.';
  end if;
  if p_email is null or p_email <> lower(btrim(p_email)) or length(p_email) > 254
    or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Invalid email address.';
  end if;
  perform 1 from public.companies where id = p_company_id for key share;
  if not found then
    raise exception using errcode = '23503', message = 'The selected company no longer exists.';
  end if;
  select * into target from auth.users where lower(email) = p_email;
  if target.id is null then
    if exists (select 1 from public.profiles where lower(email) = p_email) then
      raise exception using errcode = '23505', message = 'This email already has a portal profile. No account was changed.';
    end if;
    return jsonb_build_object('user_id', null);
  end if;
  select * into profile from public.profiles where id = target.id;
  select company_id into assigned_company from public.recruiter_companies where profile_id = target.id;
  -- Never convert a public signup or an existing active account. Only this flow's
  -- unconfirmed, company-bound Auth accounts may resume provisioning/email delivery.
  if target.email_confirmed_at is not null or target.last_sign_in_at is not null
    or nullif(target.raw_app_meta_data->>'portal_recruiter_invite', '') is null
    or (target.raw_app_meta_data->>'portal_recruiter_company') is distinct from p_company_id::text
    or (profile.id is not null and (profile.role <> 'recruiter'
      or lower(profile.email) is distinct from p_email or assigned_company is distinct from p_company_id))
    or exists (select 1 from public.profiles where lower(email) = p_email and id <> target.id) then
    raise exception using errcode = '23505', message = 'This email belongs to an existing or incompatible account. No account was changed.';
  end if;
  return jsonb_build_object('user_id', target.id,
    'request_id', target.raw_app_meta_data->>'portal_recruiter_invite');
end
$function$;

create function public.portal_provision_recruiter(
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
      return p_user_id; -- Idempotent retry after a lost RPC response; never reassign/update.
    end if;
    raise exception using errcode = '23505', message = 'An incompatible profile already exists.';
  end if;
  insert into public.profiles(id, full_name, email, role)
    values (p_user_id, btrim(p_full_name), p_email, 'recruiter');
  insert into public.recruiter_companies(profile_id, company_id) values (p_user_id, p_company_id);
  -- The existing deferred triggers validate exactly-one membership at commit.
  return p_user_id;
end
$function$;

alter function public.portal_recruiter_invite_target(uuid, text, uuid) owner to postgres;
alter function public.portal_provision_recruiter(uuid, uuid, uuid, text, text, uuid) owner to postgres;
revoke all on function public.portal_recruiter_invite_target(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.portal_provision_recruiter(uuid, uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.portal_recruiter_invite_target(uuid, text, uuid) to service_role;
grant execute on function public.portal_provision_recruiter(uuid, uuid, uuid, text, text, uuid) to service_role;
notify pgrst, 'reload schema';
commit;
