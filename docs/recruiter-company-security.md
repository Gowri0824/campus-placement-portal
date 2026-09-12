# Recruiter Company Security

Frontend follow-up: read-only My Company and Company Drives are now available. See [module architecture and verification](recruiter-company-drives.md). This security migration and its policies were not changed by that feature.

## Applied State

Migration `20260908120000_recruiter_company_security.sql` was applied to linked Supabase project `azvnttqqtebabuuxtmle` on 2026-09-08 with `supabase db push --linked`. Only that migration was pending; all seven preceding durable migrations already matched remote history. Docker was not used.

The live catalog confirmed the five existing public tables, UUID relationship columns, existing RLS/grants and application lifecycle functions. There were two Student profiles, two Admin profiles and no Recruiter profiles. No existing recruiter needed a guessed assignment. The earlier foundation's live-inspection limitation is resolved.

No frontend, authentication-user, storage, application lifecycle, or existing data changes were made in this task. Existing uncommitted frontend work was preserved.

## Relationship And Integrity

`public.recruiter_companies` contains only:

- `profile_id uuid PRIMARY KEY`, referencing `profiles.id` with `ON UPDATE NO ACTION ON DELETE RESTRICT`.
- `company_id uuid NOT NULL`, referencing `companies.id` with the same non-cascading behavior.

The primary key creates a unique index on `profile_id`. `idx_recruiter_companies_company_id` indexes `company_id` without making it unique: multiple recruiters can belong to the same company.

`portal_guard_recruiter_membership()` validates that the referenced profile exists and has role `recruiter`. It rejects authenticated non-Admin writes before revealing profile-validation details. It also prevents changing an assignment's `profile_id` and locks the profile row to serialize membership operations with role updates.

Exactly one means more than a unique key. Deferred constraint triggers call `portal_require_recruiter_company()` on profile creation/role changes and membership changes. At transaction completion:

- Every recruiter must have one membership.
- No non-recruiter may retain a membership.
- Company reassignment is an UPDATE of the same membership row.
- Deleting a membership alone fails at commit while its profile remains a recruiter.
- Trusted deprovisioning must remove membership and change the role in the same transaction. No cascade deletes are used.

The migration deliberately aborts if a membership table already exists, existing recruiters would need backfill, the audited policies have drifted, or the schema/role-security prerequisites differ. It never silently overwrites a relationship or assigns a company by guesswork.

## RLS Rules

All policies below target `authenticated`. Role checks use the existing `portal_has_role()` based on `profiles.role` and `auth.uid()`, not editable JWT metadata.

| Table / policy | Command | Predicate |
| --- | --- | --- |
| recruiter_companies: Recruiters can read own company assignment | SELECT | `profile_id = auth.uid()` AND current profile role is recruiter |
| recruiter_companies: Admins can read recruiter assignments | SELECT | Current profile role is admin |
| recruiter_companies: Admins can create recruiter assignments | INSERT | WITH CHECK current profile role is admin |
| recruiter_companies: Admins can update recruiter assignments | UPDATE | USING and WITH CHECK current profile role is admin |
| recruiter_companies: Admins can delete recruiter assignments | DELETE | Current profile role is admin; integrity checks still apply |
| companies: Recruiters can view own company | SELECT | `id = portal_recruiter_company_id()` |
| placement_drives: Recruiters can view own company drives | SELECT | `company_id = portal_recruiter_company_id()` |
| companies: Recruiter company scope boundary | Restrictive SELECT | Not a recruiter OR `id = portal_recruiter_company_id()` |
| placement_drives: Recruiter drive scope boundary | Restrictive SELECT | Not a recruiter OR `company_id = portal_recruiter_company_id()` |
| students: Recruiter student access disabled | Restrictive ALL | USING and WITH CHECK: not a recruiter |
| applications: Recruiter application access disabled | Restrictive ALL | USING and WITH CHECK: not a recruiter |

The two old `Students and recruiters can view ...` policies were narrowed to Student-only and renamed `Students can view companies` / `Students can view placement drives`. Their Student predicates are unchanged. All existing Admin policies and existing table/column grants were preserved.

Restrictive policies combine with AND, so another permissive SELECT policy cannot restore cross-company access. They grant nothing to Student/Admin by themselves and leave those roles' existing policies authoritative. See [PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

`portal_recruiter_company_id()` takes no caller-selected identity, returns only the current recruiter's company, and rechecks the live profile role. It is STABLE SECURITY DEFINER, owned by postgres, with an empty search_path and fully qualified relations. Anonymous/PUBLIC execution is revoked; authenticated execution is granted. Trigger helpers also have empty search paths and cannot be called by ordinary API clients.

On the new table, anonymous/PUBLIC access is revoked. Authenticated callers receive SELECT, DELETE, INSERT of the two columns and UPDATE of `company_id` only, with RLS deciding which caller can use each operation. There is no authenticated TRUNCATE or profile-ID UPDATE grant.

Recruiters still cannot access Student directories, applications, applicant resumes, or company/drive CRUD. Own-profile reads remain available. Profile-role UPDATE remains unavailable to all ordinary authenticated clients, including Admin frontend sessions; trusted owner-level provisioning is required to create/promote a recruiter.

## Provisioning

Create the real authentication account through the existing trusted Auth process. Then use an owner-level SQL transaction to create/promote its corresponding profile and assign the intended existing company together. Do not place privileged keys in the frontend. There is no new provisioning RPC in this phase.

The following SQL Editor template is intentionally inert until both UUID variables are provided. It only works with an existing, deliberately chosen profile. It does not create Auth users or delete academic records.

```sql
begin;
do $provision$
declare
  recruiter_profile uuid := null; -- Set the verified account's profiles.id.
  assigned_company uuid := null;  -- Set the intended existing companies.id.
begin
  if recruiter_profile is null or assigned_company is null then
    raise exception 'Provide verified profile and company UUIDs before provisioning';
  end if;
  update public.profiles set role = 'recruiter' where id = recruiter_profile;
  if not found then raise exception 'Profile does not exist'; end if;
  insert into public.recruiter_companies(profile_id, company_id)
  values (recruiter_profile, assigned_company)
  on conflict (profile_id) do update set company_id = excluded.company_id;
end
$provision$;
commit;
```

After provisioning, an authenticated Admin can reassign `company_id` under RLS. Neither recruiter self-assignment nor separate requests that leave a committed recruiter without membership are supported.

## Verification

`supabase/tests/recruiter_company_security.sql` is a durable regression test, not a migration. It creates fresh random-UUID fixtures without Auth users or passwords, switches to non-bypass `authenticated` / `anon` roles with transaction-local auth claims, asserts behavior and ends with ROLLBACK. Role-based access assertions and mutations run under actual RLS. Owner access is used for schema/fixture setup and separate integrity checks for privileged provisioning, role demotion and parent deletion.

All 49 assertions passed both before deployment (migration plus tests in one rollback transaction) and after deployment. Coverage includes:

- Recruiter A and B see only their own memberships, companies and drives.
- Self/cross-recruiter assignment changes, deletion, company/drive writes, selection and self-promotion are denied.
- Admin assignment creation, reading and reassignment succeed.
- Duplicate/null memberships, missing companies and non-recruiter profiles are rejected.
- Unassigned recruiters, stale memberships after role demotion and unsafe parent deletion are rejected.
- Recruiter Student/application access stays disabled, even with temporary additional permissive SELECT policies.
- Student company/drive reads, own-record privacy, profile edits, application uniqueness, withdrawal and eligible same-row reapplication still pass.
- Admin Student/application reads and Selected status updates still pass.
- Anonymous company/drive/membership reads and helper calls are denied.

Post-deployment catalog checks confirmed the migration-history entry, validated foreign keys, indexes, and RLS on all six tables. Before/after fingerprints matched for all existing profiles, students, companies, placement drives and applications. Recruiter profiles/memberships remained zero; no fixture policies persisted.

Run the applied-schema suite from the project directory:

```powershell
./scripts/test-recruiter-security.ps1
```

Before this migration is installed on a matching project, use `-IncludeMigration` to combine it with the tests in a single rollback transaction. Do not use that switch after installation: the existing-table preflight correctly refuses it. The runner generates and removes one temporary SQL file outside the worktree to avoid Windows command-line limits.

Lint/build were not required because no frontend compatibility changes were needed. These are database role simulations, not real recruiter browser sessions. Real login/PostgREST smoke testing requires a deliberately provisioned recruiter account.

## Next Feature

Build company association resolution in a React-independent recruiter service, then read-only **My Company / Company Drives**, using the existing hook/page/component architecture and the new server-enforced scope. Keep applicant/resume/status screens disabled until a separate, reviewed company-scoped access migration is implemented.
