# CI Quality Checks

Workflow: **Portal Quality Checks**, in `.github/workflows/quality-checks.yml`.
It runs on pushes to `main` and pull requests targeting `main`, including forks.
It does not deploy, apply migrations, contact the live portal, or start
multi-college development.

## Automatic Checks (No Secrets)

One Ubuntu job uses Node 22.x. The locked Vite requires Node 22.12+ and ESLint
requires 22.13+ on this release line; local validation uses Node 22.14.0.
Checkout/setup-node are pinned to verified commit hashes. The token is limited
to `contents: read`, checkout does not persist it, and only npm's download cache
is reused (keyed by `package-lock.json`), not `node_modules`.

Checks execute in this order, with nonzero exit codes failing the job:

```sh
npm ci
npm run scan:repository
npm run lint
npm test
npm run build
npm run scan:frontend
```

`npm test` runs `node --experimental-vm-modules --test tests/*.test.mjs`:

- Existing 67 company/applicant/dashboard/decision/invitation fixtures cover
  services, hooks, rendered components, route guards, status semantics,
  pagination, lazy resumes, failure handling, and shared Student/Admin behavior.
- Six secret-scan regressions verify detection, nonzero failure exits, public
  configuration handling, ignored versus tracked sensitive files, and missing
  build output. They use disposable local fixtures, never real credentials.
- Supabase/Auth/Storage/network responses are mocked; these are not live RLS,
  email-delivery, or authenticated browser tests.

The build receives explicit inert values for `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. No real project keys or `.env` file are needed. Its
bundle is only compiled/scanned, never deployed or uploaded as an artifact.
To reproduce that build locally in PowerShell, set these process variables
before `npm run build` (or run in a fresh shell and close it afterward):

```powershell
$env:VITE_SUPABASE_URL = 'https://ci-placeholder.invalid'
$env:VITE_SUPABASE_ANON_KEY = 'ci-placeholder-not-a-credential'
```

## Secret Scan Boundaries

The repository scan checks tracked files plus non-ignored untracked files in
the current checkout. Tracked `.env`, local metadata, build output, and common
credential-file paths fail even if `.gitignore` would otherwise exclude them.
It detects common Supabase/GitHub token formats, private keys, password-bearing
PostgreSQL URLs, and service-role JWTs without printing their values.
Legitimate server-side environment variable references and public anon keys
are allowed. `.env.example` is allowed as a path but still scanned for secrets.

The existing frontend scan checks `src`, `shared`, and the fresh `dist` output
for privileged keys/JWTs and server-secret references. Missing build output
fails. These targeted scans do not inspect full Git history, find every possible
password/provider token, or replace GitHub secret scanning/push protection.
If a real credential is exposed, revoke/rotate it; do not merely remove it or
disable the check.

## Manual Pre-Release Checks

Only an authorized maintainer should run these against the intended linked
Supabase project, with its existing migrations already applied. Authenticate
the CLI normally and verify the linked project first. No Docker is required.
The provisioning runner uses an offline cached Supabase CLI; install/cache the
CLI before running it. Do not use `-IncludeMigration` for a routine release check.

```powershell
powershell -NoProfile -File scripts/test-recruiter-security.ps1 -Suite company
powershell -NoProfile -File scripts/test-recruiter-security.ps1 -Suite decisions
powershell -NoProfile -File scripts/test-recruiter-provisioning.ps1
```

These run `supabase/tests/*.sql` through `supabase db query --linked`. They
require privileged database/Management API access to create transaction-local
fixtures and assume test roles. Assertions exercise RLS under non-bypass roles;
fixtures roll back. The `decisions` suite includes the applicant suite plus
Student withdrawal/re-application and Admin regressions; running `applicants`
again is unnecessary. They stay out of PR CI to avoid exposing live access or
letting untrusted PR SQL execute against the database, even with ROLLBACK.

Also run the non-mutating endpoint checks manually when the deployed function
and expected allowed origin are available:

```sh
node scripts/check-invite-endpoint.mjs https://PROJECT_REF.supabase.co/functions/v1/invite-recruiter http://127.0.0.1:5173
```

This command needs no login secret but depends on a live deployment, so it is
not part of offline CI. Complete authenticated Student/Admin/Recruiter browser
smoke tests, invitation delivery/password setup, company isolation, decisions,
and private signed resume access using controlled accounts and safe test data.

## GitHub Configuration And Limits

- No custom GitHub Secrets are required for this workflow. GitHub supplies its
  normal read-only job token; do not add a frontend service-role key.
- After the workflow is pushed and first passes, make its quality job a required
  status check in the `main` branch ruleset. Workflow failure alone does not
  prevent a maintainer from merging without branch protection.
- A future separately approved live-test workflow would need a protected
  environment, maintainer approval, an authorized `SUPABASE_ACCESS_TOKEN`,
  project linking, and possibly `SUPABASE_DB_PASSWORD` depending on the chosen
  connection method. None are configured or requested now; never expose them
  to pull-request code. Browser tests would also require controlled accounts.
- Existing Vite bundle-size and experimental Node VM warnings are non-blocking.
  The fixture VM flag is required by the existing test harness.
- Local verification cannot execute GitHub's hosted orchestration; the first
  real Actions run remains to be checked after an explicitly requested push.

## Local Verification (2026-09-12)

On Windows with Node 22.14.0/npm 10.9.2: `npm ci`, both scans, lint, all 73 tests,
and the inert-config build passed. Workflow YAML, triggers, read-only permission,
action pins, and command sequence were also validated. The existing Vite server
was briefly stopped to release a native-module file lock for `npm ci`, then
restored on `http://127.0.0.1:5173/login` (HTTP 200).

`npm ci` reported seven existing dependency advisories; a read-only `npm audit`
confirmed one moderate and six high findings in baseline-browser-mapping,
brace-expansion, browserslist, nanoid, postcss, react-router, and react-router-dom.
These need separate dependency review. No versions or lockfile were changed.
Dependency-audit findings are not a gating step in this workflow; the requested
lint/test/build/secret-scan checks are. No live Supabase tests were executed.

The original advisories are reviewed and addressed separately in the
[dependency audit](dependency-audit-2026-09-12.md); the paragraph above records
the findings at initial CI setup, not the current dependency state.

References: [GitHub's Node.js workflow guide](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
and [setup-node caching](https://github.com/actions/setup-node#caching-global-packages-data).
