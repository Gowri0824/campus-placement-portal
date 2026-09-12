# Recruiter Applicant Decisions

Implemented and applied to linked project `azvnttqqtebabuuxtmle` on 2026-09-12.

## Rules And Database Enforcement

- Recruiter role is resolved from `profiles.role`, never a React role value.
- Only own-company drive applications can transition from `Applied` to `Selected` or `Rejected`.
- Recruiters cannot update any `Selected`, `Rejected` or `Withdrawn` row, including no-op updates.
- Recruiters cannot insert/delete applications, change applicant/drive references, IDs or dates.
- Existing Admin status management and Student withdrawal/reapply remain unchanged.
- Existing uniqueness, eligibility, deadline, ownership and private resume protections remain intact.

Migration: `supabase/migrations/20260912120000_recruiter_applicant_decisions.sql`.

The migration alters/renames the restrictive recruiter UPDATE denial to `Recruiter application decision boundary`, then adds the permissive `Recruiters can decide company applications` policy. Both require the existing `portal_recruiter_drive_ids()` scope; OLD rows must be Applied and NEW rows must be Selected/Rejected. The restrictive boundary prevents another permissive policy from widening recruiter access.

The separate `portal_enforce_recruiter_application_decision` trigger runs before every application UPDATE. For a recruiter it checks scope, the OLD/NEW transition, and equality of all non-status fields. It uses a fixed empty search path, has no browser-callable EXECUTE grant, and leaves non-recruiter callers to their unchanged guards and RLS. No existing Student/Admin policy or trigger is replaced.

Only the existing authenticated `UPDATE(status)` grant is used. The migration has no DROP/TRUNCATE/CASCADE, data rewrite/deletion, new column grants, or change to Storage policies. Preflight assertions fail if audited policies, grants, constraints or lifecycle triggers differ.

## Frontend

`RecruiterApplicants -> useRecruiterApplicants -> decideRecruiterApplication -> normal Supabase client`

- Presentational `RecruiterApplicantDecision` renders Select/Reject only for Applied rows.
- The hook confirms before sending, prevents duplicate clicks, handles scope changes/unmount, and updates the same mapped row only after a verified success.
- The service updates only status and filters by application ID, drive ID and expected `Applied` status. Zero returned rows or mismatched results are errors, not successes. The server remains the security boundary.
- Filters, matching counts and pagination derive from the updated rows. Expanded details stay open. Changing the result scope invalidates the lazy resume cache.
- Rejected applications retain history/details but no new resume signing authorization under the existing policy. Already issued signed URLs can remain usable until expiry; this task does not change that existing Storage behavior.
- Dashboards read live status counts when opened/refreshed. Applied alone is Pending; Withdrawn stays separate. No realtime subscriptions added.

## Verification

1. Inspected live columns, column grants, RLS policies and application trigger definitions.
2. Reviewed migration SQL and tested migration plus all applicant assertions in one rollback-only transaction BEFORE application.
3. Dry-run listed only this migration. Applied through `supabase db push --linked --yes`.
4. Verified migration history, both policies, enabled trigger and RLS status read-only.
5. Re-ran all 115 rollback-only applicant/security assertions after deployment: all passed. Fixtures and temporary policy/grant probes rolled back; no persistent test users, records or files were created in Supabase.
6. All 67 Node fixture/regression tests passed, including decision validation, returned-result checks, confirmation cancellation, duplicate clicks, success/error, scope changes, filtering, details and existing paginated reads above 1,000 rows.
7. Lint/build passed. Vite retains its existing >500 kB bundle warning.
8. Browser `/recruiter/applicants` redirected to `/login` while signed out. No authenticated recruiter session or designated disposable applicant was available for a real button decision. Existing Vite HMR WebSocket/secondary logging errors were observed.

The older company suite's Admin assignment-count assertion assumed there were no existing live recruiter assignments. It was corrected to count its own fixture UUIDs; it does not hide or change live assignments. Company-boundary assertions still inspect all rows visible to each test recruiter. Its rerun passed all 49 assertions. The frontend secret scan also passed.

Commands:

```powershell
# Before first deployment only: combines migration and tests, then rolls back.
powershell -NoProfile -File scripts/test-recruiter-security.ps1 -Suite decisions -IncludeMigration
# After deployment: current database tests, fixtures roll back.
powershell -NoProfile -File scripts/test-recruiter-security.ps1 -Suite decisions
powershell -NoProfile -File scripts/test-recruiter-security.ps1 -Suite company
node --experimental-vm-modules --test tests/*.test.mjs
npm run lint
npm run build
```

## Remaining Authenticated Smoke Test

Log in as a recruiter and identify two disposable Applied test applications for the assigned company. Cancel a decision once and verify no change; confirm Select for one and Reject for the other. Check feedback, filters, details, lack of further decision controls and dashboard counts after navigation/refresh. Check appropriate resume access. Verify the Student sees the result and Admin can still manage it. Use a second company/recruiter test account to verify UI isolation; server-side denials already passed rollback tests. Do not change real candidate outcomes merely for testing.

Implementation and database regression verification are complete; real authenticated browser decision smoke testing is pending. No Git commit/push performed. Pre-existing uncommitted work remains preserved.

## Files

Created:
- `supabase/migrations/20260912120000_recruiter_applicant_decisions.sql`
- `src/components/recruiter/RecruiterApplicantDecision.jsx`
- `tests/recruiterDecisions.test.mjs`
- `docs/recruiter-applicant-decisions.md`

Updated:
- `src/constants/applicationStatuses.js`
- `src/services/recruiterApplicantsService.js`
- `src/hooks/useRecruiterApplicants.js`
- `src/pages/recruiter/RecruiterApplicants.jsx`
- `src/components/recruiter/RecruiterApplicantsTable.jsx`
- `src/styles/recruiter.css`
- `tests/recruiterApplicants.test.mjs`
- `supabase/tests/recruiter_applicant_security.sql`
- `supabase/tests/recruiter_company_security.sql`
- `scripts/test-recruiter-security.ps1`
