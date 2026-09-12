# Recruiter Foundation

## Current Status

My Company and Company Drives are now implemented; see [Company/Drives architecture and verification](recruiter-company-drives.md). The initial shell notes below remain as historical context.

The notes below record the initial foundation phase. On 2026-09-08, CLI access was restored, the live schema/policies were inspected, and `20260908120000_recruiter_company_security.sql` was applied successfully. Company membership and scoped RLS are now implemented and verified with rollback-only SQL tests. See [Recruiter Company Security](recruiter-company-security.md) for the current rules, provisioning requirements and verification results. The frontend still intentionally contains only the original dashboard shell.

## Scope And Verification Boundary

This phase adds `/recruiter` (redirecting to `/recruiter/dashboard`), a recruiter-only layout, an account summary, and logout. It does not enable company, drive, applicant, resume, or status-management access.

Live inspection on 2026-09-08 reached the configured Supabase endpoint, but zero-row reads of `profiles`, `companies`, `placement_drives`, `applications`, and `students` returned HTTP 401 / PostgreSQL 42501 (permission denied). OpenAPI also returned 401. These checks confirm anonymous reads are denied; they do not reveal live columns, foreign keys, or authenticated policies. The linked project metadata exists, but the Supabase CLI package is unavailable locally. No credentials were extracted, no service-role client was introduced, and no database changes were applied.

Run `docs/sql/recruiter-schema-audit.sql` in the linked project's Supabase SQL Editor and review the catalog results before planning a migration. The script is read-only, inspects metadata rather than user records, and does not require Docker. An existing live association may be absent from the repository; do not create a duplicate without checking.

## Repository Findings (Not A Live Schema Certification)

- `profiles`: auth identity uses `id`, `full_name`, `email`, and `role`. Roles include `student`, `admin`, and `recruiter`.
- `students`: services use `id`, `profile_id`, `roll_number`, `branch`, `cgpa`, `graduation_year`, `skills`, `resume_url`, and `created_at`.
- `companies`: services use `id`, `company_name`, `website`, `description`, `location`, and `created_at`.
- `placement_drives`: services use `id`, `company_id`, `role`, `min_cgpa`, `allowed_branches`, `package`, `deadline`, and `created_at`.
- `applications`: services use `id`, `student_id`, `drive_id`, `status`, and `applied_at`.
- The foreign-key cleanup migration establishes students -> profiles, drives -> companies, applications -> students, and applications -> drives with UUID keys and non-cascading delete behavior.
- No recruiter-company association is referenced by repository code or migrations. Previously there was only a placeholder dashboard and a recruiter-specific ProtectedRoute.
- `AuthProvider` already loads the current user's profile through `authService`. The new shell reuses that context instead of querying profile details again.

## Security Issue To Resolve Before Enabling Recruiter Data

`20260901220000_rls_role_security.sql` contains `Students and recruiters can view companies` and `Students and recruiters can view placement drives`. Their predicates grant all recruiter-role users SELECT visibility across those tables, without company scoping. Confirm whether those exact policies remain live. Hiding data in this shell does not repair those existing server permissions.

The committed migrations do not grant recruiters applicant/student-directory access, application updates, or resume reads. Profile self-read is supported, while authenticated updates to `profiles.role` are not granted. Check live grants, policies and lifecycle functions before relying on these statements operationally.

Do not enable business data screens or provision production recruiter access until the live audit and scoping migration are complete.

## Proposed Minimal Association

If no suitable live relationship already exists, add `public.recruiter_companies` with:

| Column | Constraint | Meaning |
| --- | --- | --- |
| `profile_id` | UUID primary key, FK to `profiles.id`, ON DELETE RESTRICT | One current company per recruiter account |
| `company_id` | UUID NOT NULL, FK to `companies.id`, ON DELETE RESTRICT | Multiple recruiter accounts may belong to one company |

Add an index on `company_id` if missing. No extra identity columns or separate auth system are needed. RESTRICT protects associations against accidental company/profile deletion and preserves existing auth-linked records. Authorized reassignment/removal must be explicit.

This small table is preferable to a self-editable `profiles.company_id`: association management gets an independent admin-only write policy and does not extend broad profile-update behavior. Only trusted admin provisioning may assign recruiter roles or memberships. A migration should validate that the referenced profile has role `recruiter`; every access helper must also check the current role so stale memberships cannot confer recruiter access after a role change.

This is a proposal, not an applied schema or a runnable migration. The one-company-per-recruiter assumption must be confirmed before implementation.

## Proposed Access Matrix

| Resource | Recruiter access |
| --- | --- |
| Own profile | Read using existing AuthProvider; preserve role/identity write restrictions |
| Recruiter-company membership | Read own association only; admin-managed writes; no self-assignment |
| Company | SELECT only for associated company; no company CRUD initially |
| Placement drives | SELECT only for associated company; no drive CRUD initially |
| Applications | SELECT only for drives belonging to associated company |
| Students/profiles | Read relevant applicant rows only, never the full directory |
| Resumes | Signed access to an authorized applicant's current referenced file only |
| Application status | Keep Admin-only updates for the first recruiter phase |

The scoping migration must replace the existing broad recruiter read clauses while preserving the Student clauses and all Admin policies. Adding a restrictive-looking permissive policy without removing the broad one will not constrain SELECT access: permissive policies combine with OR.

Use `auth.uid()` and `profiles.role`, not client-supplied company IDs or editable user metadata. Any helper that must avoid recursive policies needs a fixed empty search_path, fully qualified relations, narrowly granted EXECUTE, and no user-selected identity parameter. Audit grants and SELECT/INSERT/UPDATE/DELETE independently.

Applicant and resume authorization should follow applications -> placement_drives -> company membership. Storage authorization must match the current normalized `students.resume_url` object path, not grant a recruiter's access to every file in an applicant's folder. Prefer resume access only for active (`Applied`/`Selected`) applicants; decide the retention/privacy treatment of `Rejected`/`Withdrawn` applicants explicitly before the migration. Preserve Student/Admin resume access.

Do not expand the existing application UPDATE grant/policies merely to support a recruiter screen. If recruiter selection becomes a confirmed responsibility, extend the lifecycle guards and company-scoped policy together and test ownership, immutability, status transitions, and cross-company denials.

## Foundation Architecture

- `routes/AppRoutes.jsx`: existing ProtectedRoute wraps nested RecruiterLayout routes. Student and Admin branches are unchanged.
- `layouts/RecruiterLayout.jsx`: navigation, logout feedback, and Outlet context.
- `hooks/useRecruiterWorkspace.js`: existing auth-profile resolution and logout orchestration with duplicate-click protection.
- `pages/recruiter/RecruiterDashboard.jsx`: thin route composition.
- `components/recruiter/RecruiterAccountSummary.jsx`: presentational name/email and explicit unavailable-company state, not a claim that a verified association is absent.
- `styles/recruiter.css`: recruiter-scoped styles consistent with the existing portal palette.

No placeholder recruiter data service was added: `authService` already supplies the only data this phase uses. After the association is verified, add a React-independent `recruiterService` to resolve membership/company under RLS and a feature hook for async state. Reuse `fetchCompanyNamesByIds`, `fetchStudentDrives`, application mappers/status/date/error utilities and resume services where their query scope is appropriate. Do not call full-directory Admin loaders and then filter their results in the browser.

## Next Delivery

1. Inspect the live catalog using the accompanying read-only audit.
2. Confirm/reuse or migrate the association with admin-only assignment and company-scoped SELECT policies; preserve Student/Admin behavior.
3. Test two recruiters in different companies, an unassigned recruiter, Student, Admin and anonymous roles, including direct API denials.
4. Implement company association resolution and read-only My Company / Company Drives.
5. Add drive-scoped applicant lists and authorized resume access, then decide whether selection updates belong to Recruiter.

Recruiter is a foundation only, not a completed or security-certified business workflow. Real authenticated browser testing and RLS verification remain required.
