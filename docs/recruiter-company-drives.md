# Recruiter My Company And Company Drives

## Scope

Read-only recruiter company details and company drives are now implemented. Existing Student/Admin business behavior, authentication, SQL migrations, RLS and storage policies are unchanged. All pre-existing uncommitted work was preserved.

Protected routes under RecruiterLayout:

- `/recruiter` redirects to `/recruiter/dashboard` as before.
- `/recruiter/dashboard` preserves account details and now shows the resolved company.
- `/recruiter/company` shows company name, website, location and description.
- `/recruiter/drives` shows role, package, minimum CGPA, allowed branches and deadline.

Dashboard, My Company and Company Drives are linked in the sidebar. Every screen supports reload, loading, company-read error and unavailable-assignment feedback. Company Drives separately handles drive-read errors and a genuine no-drives state. No company editing, applications, Student directory, resume, or selection controls were added.

## Architecture

`page -> feature hook -> recruiter/domain services -> existing Supabase client`

Presentational components receive props and reuse pure utilities. No page, component or feature hook makes a direct Supabase/Auth/Storage call.

| Layer | Files and responsibility |
| --- | --- |
| Pages | `MyCompany.jsx`, `CompanyDrives.jsx`: thin route composition; existing `RecruiterDashboard.jsx` integrates resolved company |
| Hooks | `useRecruiterCompany.js`: central auth user, association/company loading, reload, warnings/errors and stale-request protection |
| Hooks | `useRecruiterDrives.js`: composes company resolution, waits for an assigned company, then loads drives and handles drive-specific errors |
| Services | `recruiterService.js`: read the authenticated profile's membership, then resolve that company's existing fields |
| Services | `companiesService.js`: new `fetchCompanyById`, reusing the existing company column selection |
| Services | `drivesService.js`: new `fetchCompanyDrives`, sharing the existing paginated drive-reading implementation with Student reads |
| Components | `RecruiterCompanyDetails.jsx`, `RecruiterDrivesTable.jsx`, `RecruiterCompanyFeedback.jsx`: read-only display and shared feedback |
| Existing components | `RecruiterAccountSummary.jsx`: resolved company link rather than outdated setup placeholder; existing `StatusMessage` handles errors/warnings |
| Utilities | Existing `formatAllowedBranches` and UTC-safe `formatDeadline`; `getSafeHttpUrl` moved unchanged to `urls.js`, with a compatibility re-export from `studentDirectory.js` |

### Company Resolution

1. Use `useAuth().user.id`; do not call `auth.getUser()` again.
2. Read `recruiter_companies(profile_id, company_id)` with `profile_id = user.id` and `maybeSingle()`.
3. A missing visible membership produces a clear contact-administrator message, without a fallback company query.
4. Read `companies` by the resolved `company_id` through the company service.
5. A missing/inaccessible company after a membership was returned is an error, not a successful unassigned state.

Membership/company reads are separate to reuse domain services. No nested-join dependency, all-company fetch, client-side company picker or new mapping implementation is needed.

### Drive Reads And State

Each drive page request uses `company_id = resolvedCompany.id` and the existing `DRIVE_COLUMNS` selection. Reads use 1,000-row ranges ordered by `created_at DESC, id ASC` until the final page. A failed later page rejects the entire read rather than presenting a partial count as a successful result. Missing company IDs never invoke the unscoped reader.

The existing Student all-drive query retains its columns, pagination, order and company-name mapping. Only its pagination implementation is now shared with the company reader. Admin CRUD queries remain unchanged.

Database RLS remains authoritative. Explicit query filters reduce unnecessary reads; changing a client-supplied filter cannot authorize access to another company. Reload re-resolves membership before fetching drives. Account changes, reloads and company changes hide previous data immediately, and effect cleanups ignore late responses from superseded requests. This is not a realtime subscription: administrator reassignment is reflected on reload or route entry.

Website links use HTTP(S) only; invalid/unsafe references are displayed as text. Descriptions preserve line breaks. Drive dates and branch formatting reuse current utilities without implementing application eligibility or lifecycle rules in this module.

## Files In This Step

Created:

- `src/pages/recruiter/MyCompany.jsx`
- `src/pages/recruiter/CompanyDrives.jsx`
- `src/hooks/useRecruiterCompany.js`
- `src/hooks/useRecruiterDrives.js`
- `src/services/recruiterService.js`
- `src/components/recruiter/RecruiterCompanyDetails.jsx`
- `src/components/recruiter/RecruiterDrivesTable.jsx`
- `src/components/recruiter/RecruiterCompanyFeedback.jsx`
- `src/utils/urls.js`
- `tests/recruiterCompany.test.mjs`
- `docs/recruiter-company-drives.md`

Changed:

- `src/constants/routes.js`, `src/routes/AppRoutes.jsx`: recruiter routes only.
- `src/layouts/RecruiterLayout.jsx`, `src/styles/recruiter.css`: navigation and scoped read-only screen styles.
- `src/pages/recruiter/RecruiterDashboard.jsx`, `src/components/recruiter/RecruiterAccountSummary.jsx`: show the actual resolved company.
- `src/hooks/useRecruiterWorkspace.js`: remove obsolete unavailable-company comment; logout logic unchanged.
- `src/services/companiesService.js`, `src/services/drivesService.js`: shared scoped reads.
- `src/utils/studentDirectory.js`: compatibility re-export of the existing safe-URL utility.
- `docs/recruiter-foundation.md`, `docs/recruiter-company-security.md`: link to this feature's current state.

## Verification

- `npm run lint`: passed after removing an unused initialization exposed by pagination extraction.
- `npm run build`: passed. Existing warning remains for the main bundle exceeding 500 kB (about 555 kB minified).
- `node --experimental-vm-modules --test tests/recruiterCompany.test.mjs`: 12 tests passed. Uses installed Vite/React and Node's test runner; no added packages or credentials. Covers assigned/unassigned/error states, 1,205 company drives, per-page query scope, later-page failure, Student mapping, hook reload/account-change handling, server-rendered component fields/links/empty states and protected route structure.
- `./scripts/test-recruiter-security.ps1`: all 49 existing live rollback-only RLS/integrity/Student/Admin regression checks passed. No migration or persistent fixture was applied.
- Actual browser visits to both new recruiter routes, recruiter dashboard, Student dashboard and Admin dashboard redirected anonymous visitors to `/login`. No console errors were observed. One early URL wait timed out during navigation; subsequent DOM/URL checks and repeated navigation passed.
- Direct Supabase/Auth/Storage access scans passed for recruiter pages/components/hooks.
- `git diff --check`: passed.

Fixture tests use mocked network/auth boundaries and deterministic hook orchestration, not real signed-in recruiter sessions. The available browser session was unauthenticated. Real-login company/drives rendering and navigation still require a deliberately provisioned recruiter account using the established transactional membership workflow. Do not bypass RLS to perform that test.

## Next

After the authenticated recruiter smoke test, implement drive-scoped **Applicants / Applicant Details**, with a separately reviewed RLS/storage migration allowing only authorized applicants and their current resume files. Keep status updates Admin-only until recruiter selection responsibility is explicitly approved.
