# Stable Single-College Checkpoint

This checkpoint preserves the completed single-college portal. Multi-college
architecture is not part of this milestone.

## Included Scope

- Existing Student and Admin workflows and layered architecture.
- Recruiter company association, company/drives views, scoped applicants,
  applicant details, private resume access, and dashboard statistics.
- Admin recruiter invitation, server-side provisioning, and password setup.
- Recruiter decisions: own-company `Applied` applications may become `Selected`
  or `Rejected`; terminal decisions cannot be changed by recruiters.
- Database ownership, eligibility, deadline, uniqueness, withdrawal, and
  re-application protections remain authoritative. Pending means `Applied`;
  `Withdrawn` is separate.

Pages compose hooks and presentational components. React-independent services
perform data access. RLS and private Storage authorize access; privileged Auth
provisioning credentials remain inside the Edge Function.

## Durable Recruiter Migrations

- `20260908120000_recruiter_company_security.sql`
- `20260908150000_recruiter_applicant_security.sql`
- `20260909120000_recruiter_invitation_provisioning.sql`
- `20260912120000_recruiter_applicant_decisions.sql`

All earlier durable migrations are retained. No migration was deployed during
checkpoint preparation; remote security tests rolled back their changes.

## Checkpoint Verification

- Frontend fixtures/regressions: 67 passed.
- Remote rollback-only security: 49 company, 115 applicant/decision, and
  25 provisioning assertions passed.
- Deployed invitation endpoint: anonymous and forged-token requests rejected
  (401), untrusted origin rejected (403), allowed preflight accepted (204).
- `npm run lint`, `npm run build`, and frontend secret scan passed.
- Candidate-file credential and forbidden-artifact scans passed.

The user confirmed working Student/Admin/Recruiter flows and a successful
authenticated recruiter decision smoke test. This checkpoint preparation did
not repeat authenticated browser/email testing.

Vite's existing bundle-size warning is non-blocking. Node's experimental VM
warning is limited to the fixture test harness. Environment files, build output,
dependencies, logs, and Supabase local metadata are excluded from Git.

Earlier feature documents describe their implementation-time scope and may
mention read-only decisions or then-pending configuration. The current decision
workflow is documented in [recruiter-applicant-decisions.md](recruiter-applicant-decisions.md);
invitation configuration remains documented in [recruiter-invitations.md](recruiter-invitations.md).
Deployment secrets and environment-specific Auth/email settings are not stored
in this checkpoint.
