# Recruiter Applicants and Applicant Details

Implemented on 2026-09-09. The module is read-only and uses the existing recruiter
layout, centralized authentication, company assignment, and server-side RLS.

## Files and responsibilities

Created:
- `src/pages/recruiter/RecruiterApplicants.jsx`: route composition and feedback.
- `src/hooks/useRecruiterApplicants.js`: company-scoped loading, refresh, filters,
  client pagination, expanded details, warnings, errors, and stale-result handling.
- `src/hooks/useRecruiterApplicantResume.js`: on-demand resume opening, cached-link
  expiry/renewal, popup feedback, and invalidation on account/assignment refresh.
- `src/services/recruiterApplicantsService.js`: read-only domain orchestration.
- `src/utils/recruiterApplicants.js`: relationship mapping, sorting, scope checks,
  status/drive filtering, missing-reference warnings, and resume-action preview.
- `src/components/recruiter/RecruiterApplicantFilters.jsx`: drive/status selectors.
- `src/components/recruiter/RecruiterApplicantsTable.jsx`: read-only table/expansion.
- `src/components/recruiter/RecruiterApplicantDetails.jsx`: identity, academics,
  skills, and a signed-resume action; no database or Storage calls.
- `tests/recruiterApplicants.test.mjs`: application, service, hook, and UI fixtures.
- `tests/helpers/sourceHarness.mjs`: existing test loader/fixtures extracted for
  reuse, extended with memo/ref support for hook fixtures.
- `docs/recruiter-applicants.md`: this handoff.

Changed:
- `src/constants/routes.js`, `src/routes/AppRoutes.jsx`,
  `src/layouts/RecruiterLayout.jsx`: protected `/recruiter/applicants` and navigation.
- `src/styles/recruiter.css`: applicant filters/table/details/pagination styles.
- `src/services/applicationsService.js`: paginated, drive-ID-scoped reads only;
  all existing Student lifecycle and Admin update methods remain unchanged.
- `src/services/studentsService.js`: ID-scoped student reads reusing the existing
  profile attachment and stored-path normalization; directory behavior unchanged.
- `src/services/supabaseReads.js`: small shared pagination reader.
- `tests/recruiterCompany.test.mjs`: shared test harness and new route expectation.

Existing uncommitted work was preserved. No auth, Student/Admin page, or application
lifecycle code was redesigned. No recruiter edit/delete/status-update controls exist.

## Data flow

`RecruiterApplicants -> useRecruiterApplicants -> recruiterApplicantsService`
uses `useRecruiterCompany` for the authenticated membership/company resolution.
The service reuses `drivesService.fetchCompanyDrives`,
`applicationsService.fetchApplicationsForDrives`, and
`studentsService.fetchStudentsByIds`. It never calls the full student directory.

Drives are read with a company filter. Applications are read in batches of 100
drive IDs; each batch is independently paginated in 1,000-row ranges with stable
`applied_at`/`id` ordering. Related students and profiles use 100-ID batches.
Results are globally date/ID sorted and displayed in pages of 25 applications.
Later-page or relationship-query errors reject the whole load instead of
silently presenting incomplete counts as valid totals.

Mapping reuses `mapStudentsWithProfiles`, `mapDrivesWithCompanies`,
`mapStudentApplications`, and `getReferenceWarnings`. Only student IDs referenced
by own-company applications are loaded. Missing/inaccessible students/profiles
produce warnings and safe placeholders. Unknown/non-company drives are excluded.
Reload resolves the company assignment again and hides previous-scope results
while loading; late responses cannot restore them.

Filters support All drives or one drive, and All statuses, Applied (Pending),
Selected, Rejected, or Withdrawn. Withdrawn is never treated as Pending. Unknown
statuses are warned about and appear only under All statuses.

## Resume access

The student `resume_url` stays a stored reference; `resume_path` is normalized by
the existing `resumeStorage` utility. Neither is rendered as a public download URL.
The existing `resumeService.getTimedResumeAccess` signs the private object only on
View Resume. Temporary URLs stay in hook memory, renew before expiry, and are not
persisted. There is no bulk signing during load or details expansion.

The UI offers resume access for Applied/Selected applications, matching the
backend's conservative active-applicant rule. Rejected/Withdrawn rows retain their
details/history but show the resume restriction. Storage RLS independently checks
the current reference, owner folder, active own-company application, and object
state. A missing, replaced, or unauthorized file surfaces an error without exposing
its stored path. Cached signed URLs are bearer links until expiry; the existing
one-hour signing lifetime is unchanged and is not instant revocation.

## Security prerequisite completed

Live inspection found the previous task's migration existed locally and passed its
86 rollback assertions, but was not yet applied remotely. The CLI dry run listed
only `20260908150000_recruiter_applicant_security.sql`; that migration was applied
to linked project `azvnttqqtebabuuxtmle` before verifying the frontend integration.
No additional policy/schema changes were introduced for this UI.

That migration retains company-scoped application reads, applicant-only
student/profile reads, and restrictive recruiter student/application write
denials. Profiles retain their own-profile update rules. Resumes remain private,
with only current active-applicant objects readable by the assigned recruiter.
RLS, not these frontend filters, is the access-control boundary.

The earlier security work also added
`supabase/tests/recruiter_applicant_security.sql` and extended
`scripts/test-recruiter-security.ps1` with `-Suite applicants`; the company suite
was adjusted to assert unrelated-data denial after applicant reads were enabled.
All durable migrations and these rollback-only tests were retained.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed; Vite reports the existing single-bundle >500 kB warning.
- `node --experimental-vm-modules --test tests/*.test.mjs`: 24 tests passed.
- 1,205 applications/students/profiles and 105 drive IDs covered by fixtures.
- Fixtures cover cross-company exclusions, all filters, clearing, pagination,
  details, missing references, load/signing failures, lazy signing, expiry,
  stale requests, and existing Admin/Student service behavior.
- `powershell -File scripts/test-recruiter-security.ps1 -Suite applicants`:
  86 live rollback assertions passed after deployment.
- `powershell -File scripts/test-recruiter-security.ps1 -Suite company`:
  49 live rollback assertions passed after deployment.
- Database assertions use the authenticated/anonymous non-bypass roles with
  transaction-local identity claims, not frontend service-role credentials.
- Portal-table and Storage-object fingerprints match the pre-security audit;
  no persistent fixture records, auth users, physical files, or test policies remain.
- Actual browser: `/recruiter/applicants`, `/admin/applications`, and
  `/student/applications` redirect an unauthenticated session to `/login`.
- The stopped dev server initially caused connection/HMR errors. After restarting,
  a fresh browser tab completed redirect checks with no warning/error logs.
- Recruiter pages/components/hooks have no direct Supabase/Auth/Storage calls.
- No authenticated recruiter browser session was available. Actual Applicants
  navigation, interactive detail rendering, and real signed-file download still
  require a company-assigned recruiter login; SQL and fixtures are not a substitute.

## Next step

Run an authenticated recruiter smoke test using an existing authorized account:
open Applicants, filter each status/drive, expand details, open an Applied/Selected
resume, check inactive resume messaging, and reload after an Admin status change.
Then build read-only, company-scoped live Recruiter Dashboard statistics. Keep
selection-status management Admin-only until a separate responsibility/security
decision explicitly authorizes recruiter writes.
