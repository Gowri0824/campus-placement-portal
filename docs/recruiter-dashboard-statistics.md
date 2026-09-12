# Company-scoped Recruiter Dashboard

Implemented 2026-09-09. Recruiter remains read-only. No database migrations, RLS
policies, authentication behavior, routes, or Student/Admin business rules changed.
All pre-existing uncommitted work was preserved.

## Files

Created:
- `src/constants/recruiterDashboardMetrics.js`: the six metric definitions and
  exact status values, reusing `APPLICATION_STATUS`.
- `src/services/recruiterDashboardService.js`: independent exact, company-filtered
  counts; no React imports, row downloads, or database mutations.
- `src/hooks/useRecruiterDashboardStatistics.js`: assignment-aware loading,
  refresh/retry, scope-safe cached counts, per-metric errors, and display states.
- `src/components/recruiter/RecruiterDashboardStatistics.jsx`: presentation using
  existing `DashboardCard` and `StatusMessage`, with no database/auth calls.
- `tests/recruiterDashboard.test.mjs`: 11 service, transport, hook, UI, and regression
  tests using the existing test harness and the actual Supabase SDK.
- `docs/recruiter-dashboard-statistics.md`: this report.

Changed:
- `src/pages/recruiter/RecruiterDashboard.jsx`: remains a thin composition page;
  preserves the existing account/company summary and adds statistics.
- `src/styles/recruiter.css`: scoped responsive metric styles. Shared/Admin card
  styles and components were not changed.

## Architecture and queries

`RecruiterDashboard -> useRecruiterDashboardStatistics -> recruiterDashboardService`
uses centralized `useAuth` and the existing `useRecruiterCompany` resolution.
The presentational statistics component receives values and callbacks only.

Once an assigned company is resolved, six independent requests run concurrently:

| Metric | Count source and filter |
| --- | --- |
| Total Company Drives | `placement_drives.company_id = assigned company` |
| Total Applicants | `applications` joined to that company's drives |
| Applied / Pending | same application scope, `status = Applied` |
| Selected | same application scope, `status = Selected` |
| Rejected | same application scope, `status = Rejected` |
| Withdrawn | same application scope, `status = Withdrawn` |

All requests use `{ count: "exact", head: true }`. Application counts select
`id, placement_drives!inner(id)` and filter `placement_drives.company_id`. Inner
embedding filters the parent application rows, not merely the embedded drive.
The confirmed live `applications_drive_id_fkey` is validated and references
`placement_drives(id)` with `ON DELETE RESTRICT`. This uses the documented
[Supabase join/filter mechanism](https://supabase.com/docs/guides/database/joins-and-nesting)
and [exact counts without row bodies](https://supabase.com/docs/reference/javascript/select).

No drive-ID scan, application row download, new RPC, migration, or generic
repository was introduced. The existing table RLS is authoritative on both sides
of the join. The service does not issue any query without a company ID.

"Total Applicants" counts application records, not distinct students, consistent
with the Applicants page and status totals. One student applying to two company
drives counts twice. Withdrawn is separate, and unexpected/null statuses cannot
inflate Pending (they can only contribute to the all-applications count).

## Errors and stale values

- A count must be a nonnegative safe integer. Zero is valid; missing/invalid counts
  are failures, never converted to zero.
- `Promise.allSettled` keeps successful metrics usable if other requests fail.
- A failed first load displays `Unavailable` for that metric and a visible error.
- Refresh preserves the last successful value only for the same authenticated
  profile and confirmed company. Such values show `(refreshing)` during loading
  and `(stale)` if that metric fails again.
- Successful metrics replace old values independently, including successful zeros.
- Reload/Retry re-resolves the membership/company first. Cached statistics are
  hidden while the assignment is unconfirmed or unavailable. Account/company
  changes never display the previous scope's numbers.
- Late results from superseded requests are ignored. Repeated reload clicks while
  loading are guarded.
- Company-resolution errors/unassigned states retain the existing account feedback
  and hide the metric grid; they are not rendered as empty-company successes.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed, with the existing >500 kB bundle-size warning.
- `node --experimental-vm-modules --test tests/*.test.mjs`: 35 tests passed.
- New tests use the actual Supabase SDK with an in-memory fetch boundary to check
  six HEAD requests, `Prefer: count=exact`, inner embedding, company predicates,
  exact status predicates, and no application-row response bodies.
- Fixtures include cross-company and orphan drive references, genuine zeros,
  1,206 applications, a student applying to multiple drives, unknown statuses,
  partial/all failures, invalid counts, stale zeros, retry, account/company changes,
  unassigned states, and late responses.
- Existing role guards, company/applicant modules, Student directory/drives, Admin
  application mapping, and the Admin dashboard count service passed regressions.
- Recruiter page/components/hooks have no direct Supabase/Auth/Storage calls, and
  the new module contains no mutation/status-management controls.
- Actual browser: unauthenticated `/recruiter/dashboard` redirected to `/login`,
  with no warning/error console logs in a fresh tab.
- A real authenticated recruiter dashboard/HEAD-count response was not tested:
  no company-assigned recruiter session was available. SDK fixtures and the live
  foreign-key catalog check do not substitute for that authenticated smoke test.
- No test records, auth users, Storage files, or policy changes were made in this task.

## Read-only scope completion and remaining checks

The requested read-only Recruiter functionality is implemented: company/drive
views, scoped applicants/details, authorized private resume links, and company
dashboard counts. Final end-to-end sign-off still requires a company-assigned
recruiter login on the current live project.

Manual smoke test:
1. Open `/recruiter/dashboard` as an assigned recruiter and compare counts with
   Company Drives and Applicants. Count applications rather than unique students.
2. Confirm all four status totals, especially Withdrawn versus Pending.
3. Change an authorized test application status as Admin, reload the recruiter
   dashboard, and verify refreshed counts without recruiter write controls.
4. Check Retry under a network interruption and confirm stale/unavailable markers.
5. Verify a second company's recruiter cannot see the first company's data, and
   complete the existing applicant-details/private-resume smoke test.

Optional later polish: route-level bundle splitting. The six independent count
queries are not one transactional snapshot; concurrent application changes can
temporarily make the totals differ. A snapshot RPC is only a future optimization
if real usage warrants it, not a reason to change the database now.
