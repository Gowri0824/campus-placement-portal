# Single-College V1 Performance Audit

## Scope and Method

Baseline: clean `main`, commit `fb03d4caed07e3bb65362f89adc572c906477ad8`.
Measured on Windows, Node 22.14.0, Vite 8.0.16, with the same installed lockfile
and local public Vite configuration before and after. No dependency, database,
RLS, migration, application mutation, or infrastructure changes were made.

Reproduce with `npm run build` and `node scripts/measure-bundle.mjs`.
The measurement script builds in memory without overwriting `dist`. It traverses
the entry's static imports, excludes dynamic imports from initial JS, and reports
UTF-8 bytes and Node `gzipSync` default compression separately for each chunk.
This is an artifact comparison, not a Lighthouse, network-latency, INP or LCP
benchmark. Initial numbers describe Login/boot, not every authenticated deep link.

## Before and After

Decimal kB (1,000 bytes); gzip values in this table use the same script in both runs.

| Measurement | Before | After |
| --- | ---: | ---: |
| Initial JS, including static shared chunks | 584.934 kB | 451.497 kB |
| Initial JS gzip, sum per file | 159.596 kB | 130.480 kB |
| Largest JS chunk | 584.934 kB | 441.908 kB |
| Initial CSS (`vite build`) | 8.08 kB | 4.92 kB |
| All JS, including routes not visited | 584.934 kB | 594.899 kB |
| All JS gzip, sum per file | 159.596 kB | 182.643 kB |
| JS chunks | 1 | 33 |
| Deferred page entry chunks | 0 | 18 |
| Default 500 kB Vite warning | Present | Absent |

Initial JS is down 22.8%, and initial gzip JS is down 18.2%. The shared
`jsx-runtime` chunk adds 9.589 kB to the 441.908 kB main entry; excluding it
would overstate the improvement. Splitting slightly increases total raw JS
(1.7%) and total separately compressed JS (14.4%): visitors only load routes
they visit, but visiting every route has extra request/compression overhead.
No manual vendor chunks or increased warning limit were used to hide the warning.
Vite's own compression reporter uses different compression output: baseline
entry 161.02 kB gzip; after entry 128.00 kB plus shared runtime 3.73 kB.

Largest deferred page chunks (exclusive of shared dependencies):

| Page | Raw kB | Gzip kB |
| --- | ---: | ---: |
| Recruiter Applicants | 11.808 | 4.054 |
| Students Management | 11.127 | 3.207 |
| Placement Drives Management | 10.714 | 3.311 |
| Student Profile | 10.345 | 3.580 |
| Applications Management | 9.584 | 2.923 |
| Audit Logs | 5.109 | 1.983 |
| Admin Dashboard | 3.375 | 1.418 |

The bundler's largest module `renderedLength` estimates are React DOM client
(452,058), Supabase GoTrueClient (100,185), React Router (~93,000), Supabase
Phoenix (~39,300), Storage (~38,700), and PostgREST (~27,800). These are
pre-final-minification module attribution estimates, **not transfer bytes** and
not additive to final chunk sizes. The existing React/router/Supabase runtime,
not one oversized page, dominates the remaining initial chunk.

## Changes and Findings

- `src/routes/AppRoutes.jsx`: Login remains eager. All 16 protected feature
  pages plus Signup and PasswordSetup use module-scope `React.lazy`. Existing
  URLs, nested role guards and invite callback placement are unchanged.
- `src/routes/RouteContent.jsx` and the three layouts: Suspense wraps route
  content, preserving Admin/Recruiter navigation during loading. An accessible
  loading state and error boundary provide manual reload recovery if a chunk
  fails to load. The boundary resets on pathname change. This follows
  [React's lazy/Suspense pattern](https://react.dev/reference/react/lazy).
- `src/services/authService.js`: concurrent profile reads for the same user
  share one in-flight promise. Controlled fixture: three overlapping calls
  previously caused three reads; now they cause one. Different users remain
  isolated; resolved roles and failures are never cached. Each later refresh
  reads Supabase again. This does not suppress subscriptions or change RLS.
- `src/services/companiesService.js`: Admin company loading now uses existing
  1,000-row range pagination with an ID tie-breaker; previously capped reads
  could silently omit companies. Small datasets still take one query.
- `src/services/drivesService.js`: Admin management reuses the already-paginated
  drive reader and the company service's paginated option reader, removing two
  duplicate unpaginated queries. A 1,205-drive/1,205-company fixture requires
  four queries (two/table) and maps the final company's name correctly.
  This fixes completeness, not total-memory usage. Later-page failures reject
  rather than returning a misleading partial list.
- Application relationships already use deduplicated ID batches of 100 and
  paginated application reads, not one request per displayed applicant.
  Student My Applications loads only its referenced drives/companies.
- Admin metrics already use eight independent exact HEAD counts; recruiter
  metrics use six, scoped to their company. They do not download all rows to
  count them, and partial query failures remain visible. No RPC was needed.
- Student directory, eligibility and applicant readers already avoid eager
  resume signing. Private links remain lazy, expiring and separate from stored
  references. Eligibility waits for a selected drive before loading students.
- Directory filter/options and recruiter applicant derivations already use
  `useMemo`. No broad memoization was added: deadline-dependent action state
  must not become stale simply to reduce renders. Development StrictMode's
  repeated effects were not disabled or treated as a production benchmark.
- Audit Logs already use bounded server-side filtering/pagination, fetching
  only the current page's actor names. Those queries and audit writers are unchanged.

## Live Database Index Review

Read-only `pg_indexes` query through the linked Supabase CLI confirmed:

| Access pattern | Existing coverage |
| --- | --- |
| Auth profile ID / email lookup | `profiles_pkey`, `profiles_email_key` |
| Student ownership via profile ID | `idx_students_profile_id` |
| Drives by company | `idx_placement_drives_company_id` |
| Applications by student / drive | `idx_applications_student_id`, `idx_applications_drive_id` |
| Duplicate application check | Unique `applications_student_drive_unique (student_id, drive_id)` |
| Recruiter association | PK on `profile_id`, `idx_recruiter_companies_company_id` |
| Audit order and action/role filters | `audit_logs_created_at_idx`, `audit_logs_action_created_at_idx`, `audit_logs_role_created_at_idx` |
| Company/student/drive/application identity reads | Existing table primary keys |

No standalone application-status index exists. With only 3 applications,
3 drives, 2 companies, 2 students and 3 audit logs at inspection, there is no
demonstrated need to add it. A low-cardinality status index is not automatically
a win for exact counts under RLS. At materially larger scale, measure authenticated
query plans and latency before considering `(drive_id, status)` or ordering
indexes. No indexes were added or removed; no database speedup is claimed.

## Verification and Limits

- `npm run lint`: passed.
- `npm test`: 88/88 passed, including six new performance tests. They cover
  the real production chunk graph, lazy route declarations, loading/error
  boundary, auth deduplication/freshness/account isolation, 1,205-row lists,
  company mapping and later-page failures. Existing recruiter decisions,
  invitation authorization, audit, status-count, resume and role fixtures passed.
- `npm run build`: passed without the large-bundle warning.
- `npm run scan:repository` and `npm run scan:frontend`: passed.
- Production preview browser: Login, lazy Signup, all three anonymous role
  redirects, and PasswordSetup without a link passed. No console errors/warnings
  were captured for these pages. No accounts or application records were changed.
- The old development server was stopped when browser checks began. It was
  restarted at `http://127.0.0.1:5173/login` (HTTP 200). The available browser
  was initially signed out. Authenticated Student/Admin/Recruiter navigation
  was subsequently verified as recorded below; post-login latency was not benchmarked.
  No session extraction, fake role, RLS bypass or service-role frontend key was used.
- No live mutation/security rollback suites were rerun: no SQL/security or
  lifecycle mutation code changed. Read-only index/row-count checks are not
  authenticated RLS regression tests.
- Node's existing experimental VM warning is non-blocking. Git's local
  LF-to-CRLF notices are non-blocking. The Vite warning itself is resolved.

The focused code hardening and authenticated route smoke checks are complete,
with the conditional decision-test limitation and login warning recorded below.
Server-side directory filters/pagination, eligibility
directory request cancellation during rapid drive switching, and runtime-size
reduction remain potential future work only after realistic profiling. Do not
replace complete client-side search/counts with partial server pages silently.
For deployment, retain previous hashed assets during rollouts and configure SPA
fallback/HTML revalidation so deep links and old tabs continue working; see
[Vite's production guide](https://vite.dev/guide/build.html).

Only the performance changes, regression fixtures, measurement script and this
report are intended for the performance checkpoint.

## Authenticated Smoke Follow-Up

The follow-up browser session resolved to an authenticated Admin. Verified:

- Dashboard: live totals of 2 students, 2 companies, 3 drives, 3 applications;
  status totals Selected 2, Rejected 1, Pending 0, Withdrawn 0.
- Students: both records load; branch filter reduces two records to one;
  Clear Filters restores both.
- Companies: both records and existing controls load; direct refresh preserves
  the route and loads the data again.
- Placement Drives: all three records, company names and company options load.
- Applications: all three records load; Selected shows two, Pending shows the
  expected empty state, and clearing the filter restores all three.
- Audit Logs: three events display actor, UTC timestamp, target and status
  transitions; Recruiter filter produces the expected empty state, Admin restores
  three events, and direct refresh works. Previous/Next correctly disable for
  this single-page dataset. Multi-page reads remain verified with offline fixtures,
  not artificially populated live records.
- Lazy route loading state was observed during navigation. The signed-in Admin
  attempting a Student route redirects to the Admin dashboard. No browser console
  errors/warnings were captured during these checks.

Final local commands were rerun: lint, 88 tests, production build, both secret
scans and diff whitespace checks passed. Artifact measurements are unchanged.
Failed chunk/reload recovery remains fixture-tested; no live assets were removed
or intentionally broken to force a failure.

Student and Recruiter checks are recorded below. Recruiter Select/Reject requires
an Applied dummy applicant: none of the current applications is Applied. No
account or application was modified in these follow-ups. No new E2E framework
or test project was created.

### Student Authenticated Smoke

Verified the existing Student session in the in-app browser at
`http://127.0.0.1:5173` on 2026-09-13, without changing any records:

- Dashboard loads the signed-in account and all three feature links; direct
  refresh preserves the Student session and dashboard route.
- Profile loads identity, academic fields, skills and the existing resume
  reference/access link. A direct refresh restores branch, CGPA and graduation
  year correctly. No save, upload or resume replacement was performed.
- Placement Drives loads all three drives with company, role, criteria,
  deadline and existing application status. Direct refresh reloads all three.
- My Applications loads three applications with company/role, dates, deadlines
  and statuses (two Selected, one Rejected). Direct refresh preserves those
  results. No apply, withdraw or re-apply mutation was performed.
- Dashboard -> Profile -> Dashboard -> Drives -> Applications -> Drives ->
  Dashboard navigation succeeds, including cold route entry and reloads of
  every Student page. No stuck loading state or failed lazy import was observed.
- The initial console snapshot contained two identical `TypeError: Failed to
  fetch` entries from Supabase `signInWithPassword`. Their root cause was not
  established. The authenticated dashboard and subsequent data reads worked;
  no additional errors/warnings were recorded during the subsequent navigation
  and refresh checks. The initial entries are retained as a warning, not reported
  as a completely clean sign-in trace.

Student page smoke passed with the login-network warning above. These were
authenticated development-server checks; the production chunk graph and anonymous
production browser checks remain covered by the earlier verification. No new
timing benchmark or automated E2E suite was added. Only this report was updated
in this Student-only step; source and database were unchanged, and no commit or
push was made during that step. Recruiter sign-in subsequently enabled the checks below.

### Recruiter Authenticated Smoke

Verified the existing TCS Recruiter session in the in-app browser at
`http://127.0.0.1:5173` on 2026-09-13, without modifying records:

- Dashboard loads company-scoped totals: 2 drives, 2 applications, Applied /
  Pending 0, Selected 1, Rejected 1 and Withdrawn 0. Direct refresh and returning
  through navigation preserve these results.
- My Company displays the assigned company's name, website, location and
  description. Direct refresh preserves the company route and reloads its data.
- Company Drives displays exactly the two TCS drives with role, package, CGPA,
  branches and deadline. Direct refresh reloads both; no Infosys drive is displayed.
- Applicants displays the two TCS applications with academic and application
  details. Applied filtering produces the expected empty state. Clear Filters
  restores both; combining the Python developer drive with Selected returns one.
- Expanding that applicant displays identity, academics and skills. The resume
  link initially has no signed URL; clicking signs it on demand and opens the
  existing one-page PDF successfully in a separate browser tab. The signed token
  is not stored in this report. No file was uploaded or replaced.
- Direct refresh of Applicants restores the unfiltered two-row list. All four
  recruiter routes recover from the access/loading state with navigation intact.
- No Select/Reject controls appear for the existing Selected/Rejected records.
  The conditional live decision test was skipped because no Applied dummy
  application exists. Existing offline decision fixtures remain part of the
  passing suite; no status was reset and no new application was created for testing.
- No browser console errors or warnings were recorded during Recruiter navigation,
  refresh, filtering, details expansion or signed-resume access.

Recruiter page smoke passed. These authenticated checks use the development
server; production splitting and the failed-chunk recovery path remain covered
by the production artifact tests and fixtures, not a destructive browser test.
The earlier Student login-network warning remains the only observed browser
warning from the combined follow-up sessions.
