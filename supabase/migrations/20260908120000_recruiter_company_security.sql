-- Recruiter membership and company-scoped reads. No existing rows are rewritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(hashtext('campus-placement-portal:recruiter-company-security'));

-- Fail closed on schema drift instead of replacing an unknown live relationship.
lock table public.profiles, public.companies, public.placement_drives in share row exclusive mode;
do $preflight$
declare
  required record;
begin
  if to_regclass('public.recruiter_companies') is not null then
    raise exception 'recruiter_companies already exists; inspect it before applying this migration';
  end if;
  for required in select * from (values
    ('profiles', 'id', 'uuid'), ('profiles', 'role', 'text'),
    ('companies', 'id', 'uuid'), ('placement_drives', 'company_id', 'uuid')
  ) as columns(table_name, column_name, type_name)
  loop
    if not exists (
      select 1 from pg_attribute
      where attrelid = to_regclass('public.' || required.table_name)
        and attname = required.column_name and not attisdropped
        and atttypid = required.type_name::regtype
    ) then
      raise exception 'Unexpected type/missing column: %.%', required.table_name, required.column_name;
    end if;
  end loop;
  if exists (select 1 from public.profiles where role = 'recruiter') then
    raise exception 'Existing recruiters need explicit company assignments; do not guess or rewrite their profiles';
  end if;
  if (select count(*) from pg_class where relnamespace = 'public'::regnamespace
      and relname in ('profiles', 'students', 'companies', 'placement_drives', 'applications')
      and relrowsecurity) <> 5 then
    raise exception 'Expected RLS enabled on all five existing portal tables';
  end if;
  if to_regprocedure('public.portal_has_role(text[])') is null
    or has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') then
    raise exception 'Existing role-security prerequisites are not satisfied';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public'
      and (tablename, policyname) in (
        ('companies', 'Students and recruiters can view companies'),
        ('placement_drives', 'Students and recruiters can view placement drives'))
      and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and roles = array['authenticated']::name[]
      and qual = 'portal_has_role(ARRAY[''student''::text, ''recruiter''::text])') <> 2 then
    raise exception 'Broad Student/Recruiter policies differ from the audited definitions; review before applying';
  end if;
end
$preflight$;

create table public.recruiter_companies (
  profile_id uuid primary key,
  company_id uuid not null,
  constraint recruiter_companies_profile_id_fkey foreign key (profile_id)
    references public.profiles(id) on update no action on delete restrict,
  constraint recruiter_companies_company_id_fkey foreign key (company_id)
    references public.companies(id) on update no action on delete restrict
);
alter table public.recruiter_companies owner to postgres;
create index idx_recruiter_companies_company_id on public.recruiter_companies(company_id);
alter table public.recruiter_companies enable row level security;

-- No identity parameter: callers can resolve only their own current membership.
create function public.portal_recruiter_company_id()
returns uuid language sql stable security definer set search_path = ''
as $function$
  select membership.company_id
  from public.recruiter_companies as membership
  join public.profiles as profile on profile.id = membership.profile_id
  where profile.id = (select auth.uid()) and profile.role = 'recruiter';
$function$;
alter function public.portal_recruiter_company_id() owner to postgres;
revoke all on function public.portal_recruiter_company_id() from public, anon, authenticated;
grant execute on function public.portal_recruiter_company_id() to authenticated;

-- Serialize membership changes with profile-role updates; no role/existence
-- details are exposed to non-admin API callers before the RLS check runs.
create function public.portal_guard_recruiter_membership()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  target_profile_id uuid;
  target_role text;
begin
  if ((select auth.uid()) is not null or (select auth.role()) in ('anon', 'authenticated'))
    and not public.portal_has_role(array['admin']::text[]) then
    raise exception using errcode = '42501', message = 'Only administrators can manage recruiter company assignments.';
  end if;
  if tg_op = 'UPDATE' and new.profile_id is distinct from old.profile_id then
    raise exception using errcode = '23514', message = 'The recruiter identity of an assignment cannot be changed.';
  end if;
  if tg_op = 'DELETE' then target_profile_id := old.profile_id;
  else target_profile_id := new.profile_id;
  end if;
  select role into target_role from public.profiles
  where id = target_profile_id for update;
  if tg_op <> 'DELETE' and target_role is distinct from 'recruiter' then
    raise exception using errcode = '23514', message = 'Company assignment requires an existing recruiter profile.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;
alter function public.portal_guard_recruiter_membership() owner to postgres;
revoke all on function public.portal_guard_recruiter_membership() from public, anon, authenticated;
create trigger recruiter_companies_guard_membership
before insert or update or delete on public.recruiter_companies
for each row execute function public.portal_guard_recruiter_membership();

-- A PK enforces at most one company. These deferred checks enforce exactly one
-- for every recruiter, while allowing trusted provisioning/deprovisioning in a
-- single transaction. Ordinary Student/Admin profile edits are unaffected.
create function public.portal_require_recruiter_company()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  target_profile_id uuid;
  target_role text;
  has_membership boolean;
begin
  if tg_table_name = 'profiles' then target_profile_id := new.id;
  elsif tg_op = 'DELETE' then target_profile_id := old.profile_id;
  else target_profile_id := new.profile_id;
  end if;
  select role into target_role from public.profiles where id = target_profile_id;
  select exists (select 1 from public.recruiter_companies where profile_id = target_profile_id)
    into has_membership;
  if (target_role = 'recruiter' and not has_membership)
    or (target_role is distinct from 'recruiter' and has_membership) then
    raise exception using errcode = '23514',
      message = 'Every recruiter must have exactly one company, and only recruiters may have an assignment.',
      constraint = 'recruiter_company_required';
  end if;
  return null;
end
$function$;
alter function public.portal_require_recruiter_company() owner to postgres;
revoke all on function public.portal_require_recruiter_company() from public, anon, authenticated;
create constraint trigger profiles_require_recruiter_company
after insert or update of role on public.profiles
deferrable initially deferred for each row
execute function public.portal_require_recruiter_company();
create constraint trigger recruiter_companies_require_membership
after insert or update or delete on public.recruiter_companies
deferrable initially deferred for each row
execute function public.portal_require_recruiter_company();

revoke all on table public.recruiter_companies from public, anon, authenticated;
grant select, delete on public.recruiter_companies to authenticated;
grant insert (profile_id, company_id) on public.recruiter_companies to authenticated;
grant update (company_id) on public.recruiter_companies to authenticated;

create policy "Recruiters can read own company assignment"
on public.recruiter_companies for select to authenticated
using (profile_id = (select auth.uid()) and public.portal_has_role(array['recruiter']::text[]));
create policy "Admins can read recruiter assignments"
on public.recruiter_companies for select to authenticated
using (public.portal_has_role(array['admin']::text[]));
create policy "Admins can create recruiter assignments"
on public.recruiter_companies for insert to authenticated
with check (public.portal_has_role(array['admin']::text[]));
create policy "Admins can update recruiter assignments"
on public.recruiter_companies for update to authenticated
using (public.portal_has_role(array['admin']::text[]))
with check (public.portal_has_role(array['admin']::text[]));
create policy "Admins can delete recruiter assignments"
on public.recruiter_companies for delete to authenticated
using (public.portal_has_role(array['admin']::text[]));

-- Preserve the Student clauses and all existing Admin policies/grants.
alter policy "Students and recruiters can view companies" on public.companies
using (public.portal_has_role(array['student']::text[]));
alter policy "Students and recruiters can view companies" on public.companies
rename to "Students can view companies";
alter policy "Students and recruiters can view placement drives" on public.placement_drives
using (public.portal_has_role(array['student']::text[]));
alter policy "Students and recruiters can view placement drives" on public.placement_drives
rename to "Students can view placement drives";

create policy "Recruiters can view own company"
on public.companies for select to authenticated
using (id = (select public.portal_recruiter_company_id()));
create policy "Recruiters can view own company drives"
on public.placement_drives for select to authenticated
using (company_id = (select public.portal_recruiter_company_id()));

-- Restrictive policies AND with every permissive policy, preventing an
-- accidental broad SELECT policy from restoring cross-company visibility.
create policy "Recruiter company scope boundary"
on public.companies as restrictive for select to authenticated
using (not public.portal_has_role(array['recruiter']::text[])
  or id = (select public.portal_recruiter_company_id()));
create policy "Recruiter drive scope boundary"
on public.placement_drives as restrictive for select to authenticated
using (not public.portal_has_role(array['recruiter']::text[])
  or company_id = (select public.portal_recruiter_company_id()));
create policy "Recruiter student access disabled"
on public.students as restrictive for all to authenticated
using (not public.portal_has_role(array['recruiter']::text[]))
with check (not public.portal_has_role(array['recruiter']::text[]));
create policy "Recruiter application access disabled"
on public.applications as restrictive for all to authenticated
using (not public.portal_has_role(array['recruiter']::text[]))
with check (not public.portal_has_role(array['recruiter']::text[]));

notify pgrst, 'reload schema';
commit;
