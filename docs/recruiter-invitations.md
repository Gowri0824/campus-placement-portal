# Admin Recruiter Invitations

## Implementation And Deployment

Implemented on 2026-09-09 against linked project `azvnttqqtebabuuxtmle`.

- Applied migration `20260909120000_recruiter_invitation_provisioning.sql`.
- Deployed `invite-recruiter` with `supabase functions deploy invite-recruiter --use-api`; no Docker required.
- Set the server-only `PORTAL_SITE_URL` to `http://127.0.0.1:5173` for local smoke testing.
- Existing RLS policies, grants to browser roles, company constraints and application workflows were not changed.
- No real invitation email or persistent test user was created during implementation.

The Auth redirect allow-list, SMTP delivery and a real mailbox have NOT been verified/configured by this implementation. Complete the configuration and smoke test below before calling the invitation flow end-to-end verified.

## Architecture

`RecruiterManagement -> useRecruiterManagement -> recruiterManagementService -> invite-recruiter -> Auth Admin API / PostgreSQL RPC`

- The page composes status messages, the invitation form and the recruiter table.
- The hook handles loading, form state, validation feedback, duplicate submission prevention and refresh.
- Frontend reads use the normal Supabase client under Admin RLS. Profiles, company assignments and company options are paginated; mapping is pure.
- The form accepts only name, email and a company selection. There are no public Recruiter/Admin signup pages, deletion controls or reassignment controls.
- `shared/recruiterInvitation.js` is a pure cross-runtime request contract imported by both frontend validation and the Edge handler. It contains no infrastructure or secrets.
- `handler.js` handles HTTP/CORS, validates the caller with Auth `getUser(jwt)`, and reads `profiles.role` from the database. It never trusts a role/company association asserted by React.
- `provisioning.js` owns the Auth/database/email sequence and compensation decisions.
- `index.ts` creates the server-only privileged SDK client with session persistence disabled. It never forwards the caller's JWT to this client.
- `verify_jwt = false` disables only the legacy gateway check. The handler still requires and verifies a bearer token with Supabase Auth on every POST, then requires a live Admin profile. Anonymous/forged-token live probes return 401; Student/Recruiter fixtures return 403 before any provisioning calls.

## Provisioning And Failure Handling

1. Validate normalized email, name length/control characters and UUID company ID.
2. `portal_recruiter_invite_target` checks the current Admin actor, existing company and case-insensitive email compatibility. Only a fresh email or this flow's unconfirmed, company-bound pending account is compatible. Existing Student/Admin, active accounts and other-company assignments are rejected.
3. For a fresh email, Auth Admin `createUser` creates an unconfirmed account, without a supplied/default password or email delivery. Server-owned app metadata records the provisioning UUID and intended company; it does not grant a portal role.
4. `portal_provision_recruiter` verifies the Auth UUID, email, marker, company and live Admin actor again. It inserts `profiles(id, full_name, email, role='recruiter')` and `recruiter_companies(profile_id, company_id)` in one database transaction. Existing deferred exactly-one-company triggers remain authoritative.
5. The RPC is idempotent for an already-consistent account/company and does not overwrite profile details or reassign companies. The Edge Function permits resending only for already-provisioned pending accounts. A competing request cannot adopt an unfinished account.
6. Only after the RPC succeeds does Auth Admin `inviteUserByEmail` send the invitation, targeting `/auth/setup-password`. Supabase's invite implementation supports an existing unconfirmed account; see [Auth invite implementation](https://github.com/supabase/auth/blob/master/internal/api/invite.go).

Auth and PostgreSQL operations are NOT one distributed transaction. On a confirmed SQL failure, cleanup is attempted only for the Auth account created by the current request, with the matching server marker, no confirmation/sign-in, and verifiably no profile/assignment. No invitation has been sent at this point. Auth deletion uses the Admin API, not direct SQL deletion.

An unknown RPC outcome is never treated as proof of rollback. One idempotent retry can recover a lost response. If the result remains unknown, cleanup checks fail, an account has become active, or existing records are present, the function fails closed and reports reconciliation instead of deleting data. Failed Auth cleanup is explicit, not a false success. A lost Auth-create response can leave an unconfirmed account requiring owner review; it cannot be adopted by another concurrent request.

Email failure does NOT delete a correctly provisioned recruiter. The Admin UI shows a warning and retains the form. After fixing delivery/configuration, resubmit the same email/company to resend; it reuses the existing UUID. An accepted email request is not proof of inbox delivery. Confirmed accounts require password recovery, not re-invitation/conversion through this form.

Both RPCs have an empty search path, qualified relations, owner `postgres`, EXECUTE only for `service_role`, and an explicit `auth.role()` check. Even an authenticated Admin cannot call these RPCs directly from React. Only the server supplies the verified Admin UUID. Existing RLS remains the authority for all regular portal reads/writes.

## Password Setup

`/auth/setup-password` is outside role-protected routes so an invitation callback can establish its session. It is not a registration endpoint: without an authenticated session it shows an invitation-required message and no password form.

The existing Supabase client processes standard invitation/recovery redirect sessions. `usePasswordSetup` consumes centralized AuthProvider state, validates password/confirmation, and calls `authService.setCurrentUserPassword`. The service checks the expected current session before updating the authenticated user's password. It then signs out and redirects to `/login`; existing role routing sends the recruiter to `/recruiter/dashboard` on normal login.

Stored passwords never enter database profiles, logs, service-role RPCs or invitation form state. Password-save and sign-out failures are distinguished: retrying a failed sign-out does not set the password twice. Invalid/expired link errors are displayed. Custom email templates that deliver a raw `token_hash` or PKCE code to this route are not implemented; use the standard `ConfirmationURL` template described below.

## Required Supabase Configuration

1. In **Authentication -> URL Configuration**, allow the exact redirect `http://127.0.0.1:5173/auth/setup-password`. Check the existing Site URL; do not overwrite a working production URL just for a local test. [Redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls).
2. Keep the **Invite user** email template linked through `{{ .ConfirmationURL }}` so Supabase verifies the invite before redirecting. Do not replace it with a plain application URL or share invite URLs in chat/logs.
3. Configure/verify **custom SMTP**, sender identity and email rate limits for real recipient delivery. The default email service restricts recipients and is not a production mail solution. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
4. Use `http://127.0.0.1:5173` during this local test, not `http://localhost:5173`; CORS is restricted to the configured origin. Local invitation links work only on a machine running this frontend.
5. For production, set `PORTAL_SITE_URL` to the actual HTTPS frontend origin and add its exact `/auth/setup-password` redirect. The host must serve the SPA for that path. Keep the built-in `SUPABASE_SERVICE_ROLE_KEY` only in the Supabase Edge environment; never add a Vite service-role variable.
6. `supabase/config.toml` intentionally contains only the function's gateway setting. Do not use `supabase config push` to replace the project's existing Auth configuration with defaults.

## Verification Commands

```powershell
npm run lint
npm run build
node --experimental-vm-modules --test tests/*.test.mjs
node scripts/check-frontend-secrets.mjs
powershell -NoProfile -File scripts/test-recruiter-provisioning.ps1
powershell -NoProfile -File scripts/test-recruiter-security.ps1 -Suite company
powershell -NoProfile -File scripts/test-recruiter-security.ps1 -Suite applicants
node scripts/check-invite-endpoint.mjs https://azvnttqqtebabuuxtmle.supabase.co/functions/v1/invite-recruiter
```

The provisioning SQL suite uses fresh UUIDs and rolls back all Auth/profile/company fixtures. It tests service-only grants, forged actor denial, missing companies, incompatible emails, atomic rollback on assignment failure, idempotency, no reassignment, and recruiter scoping. The endpoint script sends only anonymous or invalid-token requests, never valid provisioning data. The Node suite tests Auth/SMTP failures with fixtures, not actual mail delivery.

Verified during implementation: lint/build, provisioning fixtures, 25 rollback-only SQL assertions, deployed anonymous/forged-token/CORS denials, existing applicant/RLS regression suite, anonymous Admin-route redirect and invitation-required browser state without console errors. Build warns about the existing single large frontend bundle; code splitting is a separate optimization.

## Manual Smoke Test

1. Start/open the updated app at `http://127.0.0.1:5173/login` and log in with an existing Admin account.
2. Open **Recruiters** (`/admin/recruiters`). Verify the provisioned recruiter list and company dropdown load without RLS/network errors.
3. Invite a new email address you control, using an existing test company and a recognizable test name. Confirm one Auth user, one recruiter profile and one company assignment exist.
4. Open the received invitation in a separate signed-out browser on the same machine. Confirm it lands at `/auth/setup-password` and shows the correct recipient email. Enter and submit the password yourself.
5. Confirm return to `/login`. Log in with that recruiter account; verify `/recruiter/dashboard`, My Company, Company Drives and Applicants show only the assigned company's authorized data.
6. Verify the recruiter cannot open `/admin/recruiters`, change company, or update application status. Verify a Student is also denied the Admin route and the Edge provisioning call.
7. Submit the now-active recruiter's email from Admin again: expect a conflict, not a duplicate or reassignment. For a still-unconfirmed provisioned invite, retrying the same email/company resends without adding rows.
8. Confirm Student login/profile/application/withdrawal/reapply and Admin statistics/status-management still work. Check browser console/network for unexpected errors.

Real Admin/Student/Recruiter JWT calls to provisioning, actual inbox delivery and password setup require these manual authenticated checks. No credentials were obtained from browser storage or local secret stores.

## Owner Recovery And Deferred Features

For `PROVISIONING_REQUIRES_REVIEW` or a persistent `PROVISIONING_IN_PROGRESS`, first wait for any in-flight request to finish. Inspect the specific Auth account and server provisioning marker, confirmation/sign-in state, profile and assignment as the project owner. If a consistent pending recruiter exists, retry email delivery normally. If the account is demonstrably this attempt's unused unconfirmed Auth account with no portal records, remove it using the trusted Auth Admin/dashboard operation and invite again. Do not delete/rewrite existing users or promote a Student profile as a shortcut. Investigate any mismatched or active account manually.

Recruiter deletion, company reassignment UI, invitation delivery tracking, bulk invitations, automatic reconciliation jobs and an Admin password-recovery action are intentionally not included.

## Files In This Change

Created: `shared/recruiterInvitation.js`; `supabase/config.toml`; `supabase/functions/invite-recruiter/{index.ts,handler.js,provisioning.js}`; `supabase/migrations/20260909120000_recruiter_invitation_provisioning.sql`; `supabase/tests/recruiter_invitation_provisioning.sql`; `src/pages/admin/RecruiterManagement.jsx`; `src/pages/auth/PasswordSetup.jsx`; `src/hooks/useRecruiterManagement.js`; `src/hooks/usePasswordSetup.js`; `src/services/recruiterManagementService.js`; `src/utils/recruiterManagement.js`; `src/utils/passwordSetup.js`; `src/components/admin/recruiters/{RecruiterInviteForm.jsx,RecruitersTable.jsx}`; `src/components/auth/PasswordSetupForm.jsx`; `src/styles/accountProvisioning.css`; `tests/recruiterInvitation.test.mjs`; `scripts/test-recruiter-provisioning.ps1`; `scripts/check-invite-endpoint.mjs`; `scripts/check-frontend-secrets.mjs`; this document.

Updated: `.gitignore`, `src/constants/routes.js`, `src/routes/AppRoutes.jsx`, `src/components/admin/Sidebar.jsx`, `src/services/companiesService.js`, `src/services/authService.js`. Pre-existing uncommitted recruiter work and durable migrations were preserved. Nothing was committed or pushed.
