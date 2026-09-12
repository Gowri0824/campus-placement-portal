# Dependency Advisory Review (2026-09-12)

Scope: the stable single-college React/Vite application and its locked npm
dependencies. No application architecture, Supabase, migration, policy, or
workflow changes are part of this review.

## Original Findings And Resolution

The initial `npm audit --json` reported **7 affected package entries: 6 high,
1 moderate**. These represent **11 distinct advisories**, not seven separate
vulnerabilities: some packages have multiple advisories, and react-router-dom
inherits the same advisory as react-router.

| Package | npm severity | Dependency / scope | Original | Minimum fixing all reported advisories on this major | Resolved | Upgrade |
| --- | --- | --- | --- | --- | --- | --- |
| baseline-browser-mapping | Moderate | Transitive / dev | 2.10.38 | 2.11.0 | 2.11.22 | Minor |
| brace-expansion | High | Transitive / dev | 5.0.6 | 5.0.9 | 5.0.9 | Patch |
| browserslist | High | Transitive / dev | 4.28.2 | 4.28.7 | 4.28.9 | Patch |
| nanoid | High | Transitive / dev | 3.3.14 | 3.3.18 | 3.3.19 | Patch |
| postcss | High | Transitive / dev | 8.5.15 | 8.5.23 | 8.5.28 | Patch |
| react-router | High | Transitive / production | 7.18.0 | 7.18.2 | 7.18.3 | Patch |
| react-router-dom | High (inherited) | Direct / production | 7.18.0 | 7.18.2 | 7.18.3 | Patch |

No major versions, downgrades, overrides, or forced audit fixes were used.
React Router 8 and Nano ID 5 are unnecessary: fixes exist on the installed major
lines. Brace-expansion's patched release drops Node 18 support, but this project
already uses Node 22 in CI and Node 22.14.0 locally, consistent with ESLint/Vite.

## Reachability Evidence

These risk assessments are code-inspection conclusions, not exploit proofs:

- `src/main.jsx` uses React's client `createRoot`; `src/routes/AppRoutes.jsx`
  uses `BrowserRouter`, `Routes`, and role-protected route layouts.
- There is no RSC plugin, unstable RSC API usage, React Router server-action
  endpoint, or React Router framework configuration in this repository.
  `vite.config.js` uses only the existing React plugin.
- No application imports of baseline-browser-mapping, brace-expansion,
  browserslist, nanoid, or postcss were found. They are marked dev dependencies
  in the lockfile and enter through lint/build tools, not browser business logic.
- No project Browserslist custom-statistics/configuration file or custom PostCSS
  configuration was found. User-uploaded resumes go to Supabase Storage; this
  app does not provide a service that compiles user-supplied CSS or glob queries.
- The inspected PostCSS input implementation calls `nanoid/non-secure` with
  the fixed positive size `6`; it does not pass student/recruiter input as size.
- Vite's inspected CSS pipeline passes `from: source` to PostCSS. Existing CSS
  is repository-owned; there is no application-side `postcss().process(userCss)`.

Development-only does not mean harmless: malicious repository/dependency inputs
can affect developer and CI processes. These fixes are worthwhile defense in
depth even where normal application users cannot reach the vulnerable inputs.

## Individual Advisory Review

### 1. Baseline Browser Mapping

**Moderate; transitive dev dependency.** Path: eslint-plugin-react-hooks ->
@babel/core -> @babel/helper-compilation-targets -> browserslist ->
baseline-browser-mapping.

[GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv): invalid or
conflicting API options can call `process.exit()` and terminate the host process.
Affected 2.x versions are below 2.11.0. The portal does not accept Baseline
options from users or call this API directly. Potential exposure is lint/tooling
input, not deployed browser requests. Fixed with the compatible 2.11.22 update.

### 2. Brace Expansion: Exponential CPU Work

**High; transitive dev dependency.** Path: eslint / @eslint/config-array ->
minimatch -> brace-expansion.

[GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp): repeated
non-expanding brace groups cause exponential recursion/work. Fixed in 5.0.7 on
the installed major. ESLint expands project file/config globs, but portal users
cannot submit patterns to this tool. Risk is developer/CI denial of service from
hostile tooling inputs. The selected 5.0.9 also covers the two later issues below.

### 3. Brace Expansion: Unbounded Final Expansion

**High; same transitive dev path.**
[GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg): compact
patterns can expand into excessive results and exhaust memory. Fixed in 5.0.8
on this major. The affected engine is used by tooling, but there is no
user-controlled production glob interface. Selected fix: 5.0.9, patch-level.

### 4. Brace Expansion: Unbounded Intermediate Arrays

**High; same transitive dev path.**
[GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895): limiting
final results did not sufficiently bound intermediate allocations, permitting
memory exhaustion. Fixed in 5.0.9. Same developer/CI input boundary; neither
5.0.7 nor 5.0.8 alone would resolve all three findings. Selected fix: 5.0.9.

### 5. Browserslist: Unbounded Caches

**High; transitive dev dependency.** Path: eslint-plugin-react-hooks -> @babel/core
-> @babel/helper-compilation-targets -> browserslist.

[GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx): distinct
query/context results accumulate without sufficient cache limits, eventually
exhausting memory. Fixed in 4.28.7. The portal has no user-submitted query API or
long-lived production Browserslist service. Ordinary linting uses bounded
project inputs; arbitrary repeated queries would be a tooling risk. Selected
fix: 4.28.9, patch-level.

### 6. Browserslist: Untrusted Custom Statistics

**High; same transitive dev path.**
[GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g): malformed
custom statistics can cause an uncaught crash or prototype writes during
normalization. Statistics can be discovered from filesystem configuration, so
it is not sufficient to avoid an explicit `stats` argument. No custom stats
file exists in this project; a malicious checkout/ancestor stats file could
still affect tooling. Fixed in 4.28.7; selected 4.28.9. No browser runtime path.

### 7. Nano ID: Negative Size

**High; transitive dev dependency.** Path: vite -> postcss -> nanoid.

[GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv): negative
sizes can loop indefinitely in non-secure generators. The non-secure module
is used by PostCSS, but with the constant positive size `6`, so the reviewed
call does not exercise the vulnerable input. No application uses Nano ID.
Fixed in 3.3.16 on this line; selected 3.3.19 also fixes the zero-size issue.
No identified production exposure; potential tooling denial of service only.

### 8. Nano ID: Zero Size In Custom Generators

**High; same transitive dev path.**
[GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8): custom
generators can fail to terminate for size zero. No customAlphabet/customRandom
call exists in application code; PostCSS's ordinary fixed-size call is not
this path. Fixed in 3.3.18; selected 3.3.19, avoiding a major Nano ID migration.

### 9. PostCSS: Source Map Path Traversal

**High; transitive dev dependency.** Path: vite -> postcss.

[GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849): malicious
CSS `sourceMappingURL` comments can traverse outside the intended directory and
incorporate local `.map` contents into generated maps. Fixed in 8.5.18. Vite uses
the affected Node-side library, so hostile source/dependency CSS is a potential
build-machine disclosure risk, even though portal users cannot supply CSS to
this pipeline. It is not a browser filesystem-read vulnerability. Selected
8.5.28 also covers the later incomplete-fix advisory.

### 10. PostCSS: Missing `from` Bypasses Map Guard

**Moderate; same transitive dev path.**
[GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp): the map
path restriction could be skipped when callers omit `from`, allowing absolute
or traversing `.map` reads. Fixed in 8.5.23. The reviewed Vite CSS call supplies
`from`, and no custom application PostCSS call was found. This specific path
is not identified in normal portal usage; patching still protects other tool
callers. Selected 8.5.28, patch-level. PostCSS's aggregate npm severity is High
because its other advisory is High.

### 11. React Router: RSC Action CSRF

**High; production dependency, but vulnerable mode not used here.** react-router
is transitive through the direct react-router-dom dependency; npm reports both
package entries for this one underlying advisory.

[GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2): unstable
React Server Components action handling can execute an action before rejecting
a cross-site request. The advisory explicitly limits applicability to unstable
RSC APIs. This project is a client-rendered BrowserRouter SPA, not an RSC server;
its separate Supabase Edge Function does not import React Router. No affected
production endpoint was identified. A compatible patch is still justified to
remove known vulnerable package code. Fixed in 7.18.2; both packages resolve to
7.18.3. No move to React Router 8 is required.

## Changes And Safety

`package.json` raises the existing caret range from `^7.18.0` to `^7.18.2`.
The lockfile resolves 7.18.3 and remains the reproducible install authority.
Targeted `npm update ... --package-lock-only --ignore-scripts --no-audit` was
used for the affected dependency families, followed by lockfile diff review.
An earlier non-forced audit dry run made no changes. No blanket update, forced
fix, dependency downgrade, direct promotion of transitives, or override was used.

The updated Browserslist requires refreshed support packages; these are the
only additional version changes and all remain on their existing major lines:

| Supporting package | Original | Resolved | Reason |
| --- | --- | --- | --- |
| caniuse-lite | 1.0.30001799 | 1.0.30001810 | Browserslist browser data requirement |
| electron-to-chromium | 1.5.376 | 1.5.427 | Browserslist browser data requirement |
| node-releases | 2.0.48 | 2.0.55 | Browserslist Node data requirement |
| update-browserslist-db | 1.2.3 | 1.3.3 | Browserslist updater requirement |

Vite, ESLint, React, React DOM, Supabase SDK, application source, CI workflow,
and all durable migrations remain unchanged. No unresolved finding required
a breaking upgrade or a deferred major-version plan.

## Verification

All seven original affected package entries are resolved; none remain or are
deferred. Both final audits completed successfully against the registry.

| Check | Result |
| --- | --- |
| `npm ci` | Passed; clean installation, zero audit findings |
| `npm run lint` | Passed |
| `npm test` | 73 passed; 0 failed/skipped |
| `npm run build` | Passed with the same inert Supabase build configuration as CI |
| `npm run scan:repository` | Passed |
| `npm run scan:frontend` | Passed, including the freshly generated bundle |
| `npm audit --json` | 0 vulnerabilities, exit code 0 |
| `npm audit --omit=dev --json` | 0 vulnerabilities, exit code 0 |

The existing Vite bundle warning remains non-blocking (579.29 kB minified JS,
159.10 kB gzip for this CI-configured build). Node's experimental VM warning is
from the existing fixture harness. The portal's local Vite process was stopped
only to release its Windows native-module lock for `npm ci`, then restored at
`http://127.0.0.1:5173/login` (HTTP 200). No real accounts, email invitations,
application decisions, or database security tests were exercised in this task.
Hosted CI has not rerun for these uncommitted changes. Nothing was committed,
pushed, deployed, or applied to live Supabase during this review.

This is a point-in-time review of npm's known advisories, not a guarantee that
the project or its dependencies have no undiscovered vulnerabilities. Local
fixtures do not replace authenticated browser testing or database RLS checks.
