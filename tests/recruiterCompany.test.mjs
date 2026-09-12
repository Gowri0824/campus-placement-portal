// Run: node --experimental-vm-modules --test tests/recruiterCompany.test.mjs
// No credentials or network requests: load actual source with mocked boundaries.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { source, loadSource, createReadFixture, hookHarness } from "./helpers/sourceHarness.mjs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const companyA = { id: "company-a", company_name: "Company A", website: "https://example.com", location: "Pune", description: "Engineering" };
const companyB = { ...companyA, id: "company-b", company_name: "Company B" };
const tables = {
  recruiter_companies: [{ profile_id: "recruiter-a", company_id: companyA.id }],
  companies: [companyA, companyB],
  placement_drives: [
    { id: "drive-a", company_id: companyA.id, role: "Engineer", package: "8 LPA", min_cgpa: 0, allowed_branches: '["CSE", "ECE"]', deadline: "2030-01-31" },
    { id: "drive-b", company_id: companyB.id, role: "Other company role" },
  ],
};

test("resolves only membership's company using separate scoped reads", async () => {
  const fixture = createReadFixture(tables);
  const service = await loadSource("services/recruiterService.js", fixture.mocks);
  assert.equal((await service.fetchRecruiterCompany("recruiter-a")).id, companyA.id);
  assert.deepEqual(fixture.calls.map(({ table, filters }) => ({ table, filters })), [
    { table: "recruiter_companies", filters: [["profile_id", "recruiter-a"]] },
    { table: "companies", filters: [["id", "company-a"]] },
  ]);
  assert.equal(fixture.calls[1].columns, "id, company_name, website, description, location, created_at");
});

test("unassigned/unauthenticated never fall back to arbitrary company reads", async () => {
  const fixture = createReadFixture(tables);
  const service = await loadSource("services/recruiterService.js", fixture.mocks);
  assert.equal(await service.fetchRecruiterCompany("unassigned"), null);
  assert.equal(fixture.calls.length, 1);
  await assert.rejects(service.fetchRecruiterCompany(null), /log in/);
  assert.equal(fixture.calls.length, 1);
});

test("missing company and denied queries are errors, not unassigned successes", async () => {
  const fixture = createReadFixture({ ...tables, companies: [] });
  const service = await loadSource("services/recruiterService.js", fixture.mocks);
  await assert.rejects(service.fetchRecruiterCompany("recruiter-a"), /assigned company is unavailable/);
  for (const failingTable of ["recruiter_companies", "companies"]) {
    const denied = createReadFixture(tables, ({ table }) => table === failingTable ? new Error("permission denied") : null);
    const module = await loadSource("services/recruiterService.js", denied.mocks);
    await assert.rejects(module.fetchRecruiterCompany("recruiter-a"), /permission denied/);
  }
});

test("company drives stay scoped on every page beyond 1000 rows", async () => {
  const rows = Array.from({ length: 1205 }, (_, id) => ({ ...tables.placement_drives[0], id: `drive-${id}` }));
  const fixture = createReadFixture({ ...tables, placement_drives: [...rows, tables.placement_drives[1]] });
  const service = await loadSource("services/drivesService.js", fixture.mocks);
  const drives = await service.fetchCompanyDrives(companyA.id);
  assert.equal(drives.length, 1205);
  assert.ok(drives.every((drive) => drive.company_id === companyA.id));
  assert.deepEqual(fixture.calls.map((call) => call.range), [[0, 999], [1000, 1999]]);
  for (const call of fixture.calls) {
    assert.deepEqual(call.filters, [["company_id", companyA.id]]);
    assert.equal(call.orders[1][0], "id");
  }
  assert.equal((await service.fetchCompanyDrives(null)).length, 0);
  assert.equal(fixture.calls.length, 2);
});

test("no-drives and later-page errors do not return partial successes", async () => {
  const rows = Array.from({ length: 1000 }, (_, id) => ({ ...tables.placement_drives[0], id }));
  const fixture = createReadFixture({ ...tables, placement_drives: rows }, (call) => call.range?.[0] === 1000 ? new Error("Read failed") : null);
  const service = await loadSource("services/drivesService.js", fixture.mocks);
  await assert.rejects(service.fetchCompanyDrives(companyA.id), /Read failed/);
  assert.equal((await service.fetchCompanyDrives("no-drives")).length, 0);
});

test("existing Student all-drive reader and company mapping remain unchanged", async () => {
  const fixture = createReadFixture(tables);
  const service = await loadSource("services/drivesService.js", fixture.mocks);
  const drives = await service.fetchStudentDrives();
  assert.equal(drives.length, 2);
  assert.equal(drives[0].companies.company_name, companyA.company_name);
  assert.equal(drives[1].companies.company_name, companyB.company_name);
  assert.deepEqual(fixture.calls[0].filters, []);
});

// Deterministic hook orchestration fixtures. Effects run after each render and
// retain cleanup semantics; these do not claim to be authenticated browser tests.
test("company hook handles assignment, refresh, account switch, unassigned and errors", async () => {
  const harness = hookHarness();
  let user = { id: "a" };
  const pending = [];
  const module = await loadSource("hooks/useRecruiterCompany.js", {
    react: harness.react,
    [source("hooks/useAuth.js")]: { useAuth: () => ({ user }) },
    [source("services/recruiterService.js")]: { fetchRecruiterCompany: (id) => new Promise((resolve, reject) => pending.push({ id, resolve, reject })) },
  });
  const hook = module.useRecruiterCompany;
  assert.equal(harness.render(hook).isLoading, true);
  pending[0].resolve(companyA);
  let state = await harness.settle(hook);
  assert.equal(state.company.id, companyA.id);
  state.refresh();
  assert.equal(harness.render(hook).company, null);
  user = { id: "b" };
  assert.equal(harness.render(hook).company, null);
  pending[1].resolve(companyA);
  assert.equal((await harness.settle(hook)).company, null);
  pending[2].resolve(companyB);
  assert.equal((await harness.settle(hook)).company.id, companyB.id);
  user = { id: "unassigned" };
  harness.render(hook);
  pending[3].resolve(null);
  state = await harness.settle(hook);
  assert.match(state.warning, /No company assignment/);
  assert.equal(state.isLoading, false);
  state.refresh(); harness.render(hook);
  pending[4].reject(new Error("permission denied"));
  state = await harness.settle(hook);
  assert.equal(state.warning, "");
  assert.match(state.error, /permission denied/);
  user = null;
  state = harness.render(hook);
  assert.equal(state.company, null);
  assert.equal(state.isLoading, false);
  assert.match(state.error, /log in/);
  harness.unmount();
});

test("drive hook waits for company, hides stale scope and reports failure", async () => {
  const harness = hookHarness();
  const pending = [];
  let companyState = { company: null, isLoading: false, refresh() {} };
  const module = await loadSource("hooks/useRecruiterDrives.js", {
    react: harness.react,
    [source("hooks/useRecruiterCompany.js")]: { useRecruiterCompany: () => companyState },
    [source("services/drivesService.js")]: { fetchCompanyDrives: (id) => new Promise((resolve, reject) => pending.push({ id, resolve, reject })) },
  });
  const hook = module.useRecruiterDrives;
  assert.equal(harness.render(hook).drives.length, 0);
  assert.equal(pending.length, 0);
  companyState = { ...companyState, company: companyA };
  assert.equal(harness.render(hook).isLoading, true);
  pending[0].resolve([tables.placement_drives[0]]);
  assert.equal((await harness.settle(hook)).drives.length, 1);
  companyState = { ...companyState, company: companyB };
  assert.equal(harness.render(hook).drives.length, 0);
  assert.equal(pending[1].id, companyB.id);
  pending[1].reject(new Error("Drive read failed"));
  const state = await harness.settle(hook);
  assert.equal(state.isLoading, false);
  assert.match(state.error, /Drive read failed/);
  harness.unmount();
});

test("read-only components render existing fields, safe URLs, dates and empty/error states", async () => {
  const { default: Details } = await loadSource("components/recruiter/RecruiterCompanyDetails.jsx");
  const { default: Table } = await loadSource("components/recruiter/RecruiterDrivesTable.jsx");
  const { default: Feedback } = await loadSource("components/recruiter/RecruiterCompanyFeedback.jsx");
  const html = renderToStaticMarkup(createElement(Details, { company: companyA }));
  for (const field of ["Company A", "Pune", "Engineering", 'href="https://example.com/"']) assert.ok(html.includes(field));
  assert.doesNotMatch(renderToStaticMarkup(createElement(Details, { company: { ...companyA, website: "javascript:alert(1)" } })), /href=/);
  const table = renderToStaticMarkup(createElement(Table, { drives: [tables.placement_drives[0]] }));
  for (const field of ["Engineer", "8 LPA", "cse, ece", "31 Jan 2030", ">0</td>"]) assert.ok(table.includes(field));
  assert.doesNotMatch(table, /<button|<input|<select/);
  assert.match(renderToStaticMarkup(createElement(Table, { drives: [] })), /No placement drives/);
  assert.match(renderToStaticMarkup(createElement(Feedback, { error: "permission denied" })), /role="alert"/);
  assert.match(renderToStaticMarkup(createElement(Feedback, { warning: "No company assignment" })), /No company assignment/);
  const { getSafeHttpUrl } = await loadSource("utils/studentDirectory.js");
  assert.equal(getSafeHttpUrl("https://example.com"), "https://example.com/");
  assert.equal(getSafeHttpUrl("javascript:alert(1)"), "");
});

test("recruiter pages/components/hooks contain no direct Supabase/Auth/Storage access", async () => {
  for (const file of [
    "pages/recruiter/MyCompany.jsx", "pages/recruiter/CompanyDrives.jsx", "pages/recruiter/RecruiterDashboard.jsx",
    "layouts/RecruiterLayout.jsx", "components/recruiter/RecruiterCompanyDetails.jsx",
    "components/recruiter/RecruiterDrivesTable.jsx", "components/recruiter/RecruiterCompanyFeedback.jsx",
    "components/recruiter/RecruiterAccountSummary.jsx", "hooks/useRecruiterCompany.js", "hooks/useRecruiterDrives.js",
  ]) assert.doesNotMatch(await readFile(source(file), "utf8"), /supabase|\.from\(|\.auth\.|\.storage\./, file);
});

test("existing role guard accepts recruiter and denies anonymous/Student/Admin", async () => {
  let auth = { isAuthReady: true, isLoading: false, isAuthenticated: true, role: "recruiter" };
  const router = { Navigate() {}, Outlet() {}, useLocation: () => ({ pathname: "/recruiter/company" }) };
  const { default: Guard } = await loadSource("routes/ProtectedRoute.jsx", {
    "react-router-dom": router,
    [source("hooks/useAuth.js")]: { useAuth: () => auth },
  });
  assert.equal(Guard({ allowedRoles: ["recruiter"] }).type, router.Outlet);
  for (const role of ["student", "admin"]) {
    auth = { ...auth, role };
    assert.equal(Guard({ allowedRoles: ["recruiter"] }).props.to, `/${role}/dashboard`);
    assert.equal(Guard({ allowedRoles: [role] }).type, router.Outlet);
  }
  auth = { ...auth, isAuthenticated: false };
  assert.equal(Guard({ allowedRoles: ["recruiter"] }).props.to, "/login");
});

test("new routes are nested under the recruiter guard and existing role branches remain", async () => {
  const routesSource = await readFile(source("routes/AppRoutes.jsx"), "utf8");
  const mocks = {};
  for (const match of routesSource.matchAll(/from "(\.\.\/(?:pages|layouts)\/[^\"]+)"/g)) {
    mocks[path.resolve(path.dirname(source("routes/AppRoutes.jsx")), `${match[1]}.jsx`)] = { default() {} };
  }
  const { default: AppRoutes } = await loadSource("routes/AppRoutes.jsx", mocks);
  const branches = AppRoutes().props.children.props.children;
  for (const role of ["recruiter", "student", "admin"]) {
    const guard = branches.find((route) => route.props.element?.props.allowedRoles?.includes(role));
    assert.ok(guard, `${role} guard exists`);
    assert.equal(guard.props.children.props.path, `/${role}`);
    const paths = guard.props.children.props.children.map((route) => route.props.path).filter(Boolean);
    assert.ok(paths.includes("dashboard"));
    if (role === "recruiter") assert.deepEqual(Array.from(paths), ["dashboard", "company", "drives", "applicants"]);
  }
});
