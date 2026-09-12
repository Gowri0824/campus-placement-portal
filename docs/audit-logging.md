# Privileged Audit Logging

Single-college V1 scope. No changes to Student, Admin, Recruiter lifecycle rules,
company scoping, Storage policies, or existing application RLS.

## Events

| Action | Actor | Meaning |
| --- | --- | --- |
| `application.status_changed` | Admin / Recruiter | A committed status change, with old/new statuses and drive UUID. |
| `recruiter.provisioned` | Admin | The trusted provisioning RPC created both the recruiter profile and company assignment. |
| `recruiter.invitation_requested` | Admin | The Edge Function recorded an authorized invitation attempt before calling Auth's invitation API. This is NOT proof of email acceptance, delivery, or password setup. |

Student withdrawal/re-application, initial applications, reads, denied requests,
and no-op status updates are deliberately not logged. Existing historical events
are not reconstructed or backfilled. Company/drive CRUD and reassignment are not
part of this first audit scope.

## Persistence and Trust Boundary

Migration: `supabase/migrations/20260912150000_privileged_audit_logs.sql`.

`audit_logs` contains a UUID primary key, actor profile UUID and role snapshot,
action, entity type/UUID, nullable old/new statuses, constrained JSON metadata, and
`created_at timestamptz`. Indexes support latest-first and action/role-filtered
reads. Actor/entity IDs are historical references, intentionally without foreign
keys: logs must not disappear or introduce new delete restrictions on existing
records. Current actor names are resolved separately through existing Admin
profile SELECT permissions; absent names fall back to the historical UUID.

Only typed server writers populate metadata, with `drive_id` or `company_id`.
No email, full name, password, token, Auth payload, resume URL, or arbitrary client
JSON is copied into audit records. The invitation request UUID doubles as the
audit row ID for idempotent retries; it is not an invitation token.

The application AFTER UPDATE trigger resolves `auth.uid()` and reads the actor's
role from `profiles`. Existing RLS and BEFORE triggers still decide whether the
mutation is permitted. The audit INSERT and original update share the same
transaction: audit-write errors fail closed; rollback removes both. See
[PostgreSQL trigger transaction semantics](https://www.postgresql.org/docs/current/trigger-definition.html).

The existing `portal_provision_recruiter` RPC keeps all original validation and
compensation boundaries. It writes its event after both inserts in that same
transaction, including the existing deferred association checks. A compatible
retry returns without duplicating the provisioning event.

The new `portal_audit_recruiter_invitation` RPC accepts only a server call with a
live Admin actor, verified pending provisioned recruiter, matching company, and
attempt UUID. Its writer is idempotent and rejects conflicting attempt IDs.
If audit confirmation fails, the Edge Function does not send email and preserves
the consistent pending recruiter for retry. If email fails after audit succeeds,
the event accurately records the request, not success. No existing account is
deleted to compensate for an audit or delivery error after provisioning.

## RLS and Grants

- `audit_logs` has RLS enabled and one SELECT policy: authenticated Admins,
  verified through `portal_has_role(array['admin'])`, may read all V1 logs.
- Student and Recruiter SELECT return no rows. Anonymous users lack SELECT.
- No browser role, including Admin, has INSERT/UPDATE/DELETE/TRUNCATE privileges.
- `service_role` also has no direct audit table privileges. It can execute only
  the specific trusted provisioning/invitation writers relevant to this flow.
- Writer functions use `SECURITY DEFINER`, owner `postgres`, empty search path,
  qualified relations, and restricted execution grants. The trigger function is
  not a callable client RPC. There is no generic client-supplied log writer.
- This is client-immutable, not tamper-proof against the database owner or a
  compromised trusted server. SQL Editor/owner maintenance without an authenticated
  portal actor is outside the status-event scope. Keep privileged credentials
  server-side. Supabase's [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
  explains the owner/service trust boundary.

## Admin UI Architecture

`/admin/audit-logs` is nested inside the existing Admin guard and layout/sidebar.

`AuditLogs.jsx -> useAuditLogs -> auditLogsService -> supabaseClient/supabaseReads`

`AuditLogFilters` and `AuditLogsTable` are presentational. Constants define event
labels/options; the shared date helper renders UTC timestamps. There are no
Supabase calls in the page, hook, or presentation components and no write controls.

The service requests 51 rows to show 50 and determine whether another page exists,
ordered by timestamp and UUID. Filters execute in Supabase, not over just the
current page. Offset pagination supports history beyond the default row limit;
concurrent new events can shift page boundaries. Refresh returns to page one.
This is a latest-events viewer, not a consistent-snapshot export system.

Failed event reads show an error/Retry, never a false empty success. Actor lookup
failures preserve events with an explicit UUID-fallback warning. Account/filter
changes hide previous results and ignore late responses.

## Verification Commands

Offline/CI (no live credentials):

```sh
npm run lint
npm test
npm run build
npm run scan:repository
npm run scan:frontend
```

Remote rollback-only checks require the already-linked Supabase CLI login, not
frontend service-role credentials. No Docker, Auth API fixture creation, email,
or physical resume operations are involved.

```powershell
# Before installation only: each command rolls back the migration and all fixtures.
powershell -NoProfile -File scripts/test-audit-security.ps1 -IncludeMigration
powershell -NoProfile -File scripts/test-audit-security.ps1 -IncludeMigration -Suite company
powershell -NoProfile -File scripts/test-audit-security.ps1 -IncludeMigration -Suite applicants
powershell -NoProfile -File scripts/test-audit-security.ps1 -IncludeMigration -Suite provisioning

# After installation: omit -IncludeMigration; all fixtures still roll back.
powershell -NoProfile -File scripts/test-audit-security.ps1
powershell -NoProfile -File scripts/test-audit-security.ps1 -Suite company
powershell -NoProfile -File scripts/test-audit-security.ps1 -Suite applicants
powershell -NoProfile -File scripts/test-audit-security.ps1 -Suite provisioning
```

Validated during implementation:
- 82 offline fixtures, including service pagination over 1,100 events, filters,
  actor failures, read-only rendering, stale response handling, route boundaries,
  and Edge audit failure preventing email without deleting a consistent account.
- 45 audit SQL assertions plus 49 company, 115 applicant/lifecycle/resume, and 25
  provisioning regression assertions, before and after migration application.
- Audit failures roll back both status changes and recruiter profile/assignment
  inserts; transaction rollback leaves no successful event behind.
- The reviewed migration was applied and `invite-recruiter` redeployed. Live
  catalog inspection confirmed RLS, grants, indexes, and migration history.
- Endpoint anonymous/forged-token/untrusted-origin/preflight checks passed.
- Signed-out browser navigation to `/admin/audit-logs` redirected to `/login`.
- Lint/build and both secret scans passed. Existing Vite chunk-size and Node VM
  experimental warnings remain non-blocking.

## Authenticated Admin Smoke Test

Completed on 2026-09-12 using the existing Admin session in Codex's browser and
user-authorized dummy application data. No credentials were extracted or bypassed.

- Admin sidebar navigation to Audit Logs loaded correctly. There were initially
  zero records; the genuine empty state was displayed without a query error.
- Changed the dummy Infosys Software Engineer application from Applied to Selected
  through Admin Applications. The success message and counts updated correctly.
- Exactly one audit event appeared with the College Admin actor/role, application
  and drive IDs, Applied-to-Selected transition, and UTC timestamp matching the
  operation. The dummy application is intentionally left Selected; no data deleted.
- Matching action/Admin filters retained the event. Recruiter, invitation-request,
  and provisioning filters correctly returned empty states. Reset and Refresh
  restored the same event without duplicates.
- Repeating Update with Selected already set displayed the no-op acknowledgment;
  reopening Audit Logs still showed exactly one event.
- No console errors/warnings or visible Auth/RLS/query errors occurred.
- The 45 rollback-only audit assertions were rerun, including database no-ops,
  denied mutations, forgery, role isolation, and transactional failures. These
  created no persistent fixture records or false audit events.

Real invitation delivery and a separate authenticated Recruiter decision were
not repeated in this smoke test. Their audit/security paths are covered by the
SQL and Edge fixtures above. Confirm their records during the next approved
invitation/recruiter session; an invitation-request event is not an email receipt.

There is no automatic retention deletion, export pipeline, or delivery webhook in
this minimal scope. Review retention/archival needs separately before significant
growth. The Audit Logging files form a separate checkpoint from any future work.
