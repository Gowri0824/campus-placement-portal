// Exact-count transport fixtures use the real SDK with an in-memory fetch boundary.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import { source, loadSource, hookHarness } from "./helpers/sourceHarness.mjs";

const companyA = { id: "company-a", company_name: "Company A" };
const companyB = { id: "company-b", company_name: "Company B" };
const drives = [
  { id: "drive-a", company_id: companyA.id },
  { id: "drive-a2", company_id: companyA.id },
  { id: "empty-drive", company_id: companyA.id },
  { id: "drive-b", company_id: companyB.id },
];
const applications = [
  { drive_id: "drive-a", student_id: "one", status: "Applied" },
  { drive_id: "drive-a2", student_id: "one", status: "Applied" },
  { drive_id: "drive-a", student_id: "two", status: "Selected" },
  { drive_id: "drive-a", student_id: "three", status: "Rejected" },
  { drive_id: "drive-a2", student_id: "four", status: "Withdrawn" },
  { drive_id: "drive-b", student_id: "five", status: "Applied" },
  { drive_id: "missing-drive", student_id: "six", status: "Applied" },
];
const expected = { drives: 3, applications: 5, pending: 2, selected: 1, rejected: 1, withdrawn: 1 };

function countFixture({ driveRows = drives, applicationRows = applications, respond } = {}) {
  const calls = [];
  const client = createClient("https://portal.example.invalid", "fixture-only-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input);
      const call = { table: url.pathname.split("/").at(-1), method: init.method,
        headers: new Headers(init.headers), params: url.searchParams };
      calls.push(call);
      const override = respond?.(call);
      if (override?.throw) throw new Error("Network unavailable");
      if (override?.error) return new Response(JSON.stringify({ message: override.error }), { status: 403 });
      const scope = call.params.get(call.table === "placement_drives" ? "company_id" : "placement_drives.company_id")?.slice(3);
      const status = call.params.get("status")?.slice(3);
      const scopeDrives = driveRows.filter((drive) => drive.company_id === scope);
      const rows = call.table === "placement_drives" ? scopeDrives : applicationRows.filter((application) =>
        scopeDrives.some((drive) => drive.id === application.drive_id) && (!status || application.status === status));
      return new Response(null, { status: 200, headers: override?.omitCount ? {}
        : { "Content-Range": `*/${override?.count ?? rows.length}` } });
    } },
  });
  return { calls, mocks: { [source("services/supabaseClient.js")]: { supabase: client } } };
}

test("six HEAD exact queries count only own-company drives/applications without row downloads", async () => {
  const fixture = countFixture();
  const { fetchRecruiterDashboardStatistics } = await loadSource("services/recruiterDashboardService.js", fixture.mocks);
  const result = await fetchRecruiterDashboardStatistics(companyA.id);
  assert.deepEqual({ ...result.counts }, expected);
  assert.deepEqual({ ...result.errors }, {});
  assert.equal(fixture.calls.length, 6);
  for (const call of fixture.calls) {
    assert.equal(call.method, "HEAD");
    assert.match(call.headers.get("prefer"), /count=exact/);
    assert.equal(call.params.get(call.table === "placement_drives" ? "company_id" : "placement_drives.company_id"), `eq.${companyA.id}`);
    if (call.table === "applications") assert.equal(call.params.get("select"), "id,placement_drives!inner(id)");
    assert.equal(call.params.get("limit"), null);
  }
  assert.deepEqual(fixture.calls.filter((call) => call.params.has("status")).map((call) => call.params.get("status")),
    ["eq.Applied", "eq.Selected", "eq.Rejected", "eq.Withdrawn"]);
  const secondCompany = await fetchRecruiterDashboardStatistics(companyB.id);
  assert.equal(secondCompany.counts.applications, 1);
  assert.equal(secondCompany.counts.drives, 1);
});

test("genuine zero counts and no-applicant drives remain valid, missing assignment never issues a query", async () => {
  const fixture = countFixture({ applicationRows: [] });
  const service = await loadSource("services/recruiterDashboardService.js", fixture.mocks);
  const result = await service.fetchRecruiterDashboardStatistics(companyA.id);
  assert.equal(result.counts.drives, 3);
  for (const key of ["applications", "pending", "selected", "rejected", "withdrawn"]) assert.equal(result.counts[key], 0);
  const empty = await service.fetchRecruiterDashboardStatistics("empty-company");
  assert.ok(Object.values(empty.counts).every((value) => value === 0));
  const count = fixture.calls.length;
  await assert.rejects(service.fetchRecruiterDashboardStatistics(null), /assignment/);
  assert.equal(fixture.calls.length, count);
});

test("counts exceed the 1000 row limit and unknown statuses are never Pending", async () => {
  const rows = Array.from({ length: 1205 }, (_, index) => ({ drive_id: "drive-a", status: index % 2 ? "Withdrawn" : "Applied" }));
  rows.push({ drive_id: "drive-a", status: "unexpected" });
  const fixture = countFixture({ applicationRows: rows });
  const service = await loadSource("services/recruiterDashboardService.js", fixture.mocks);
  const { counts } = await service.fetchRecruiterDashboardStatistics(companyA.id);
  assert.equal(counts.applications, 1206);
  assert.equal(counts.pending, 603);
  assert.equal(counts.withdrawn, 602);
  assert.equal(fixture.calls.length, 6);
});

test("partial and all query failures preserve successful counts and never invent zero values", async () => {
  const fixture = countFixture({ respond: (call) => call.params.get("status") === "eq.Selected" ? { error: "Selected query denied" } : null });
  const service = await loadSource("services/recruiterDashboardService.js", fixture.mocks);
  const partial = await service.fetchRecruiterDashboardStatistics(companyA.id);
  assert.equal(partial.counts.selected, undefined);
  assert.equal(partial.counts.pending, 2);
  assert.match(partial.errors.selected, /denied/);
  const denied = countFixture({ respond: () => ({ error: "permission denied" }) });
  const failedService = await loadSource("services/recruiterDashboardService.js", denied.mocks);
  const all = await failedService.fetchRecruiterDashboardStatistics(companyA.id);
  assert.equal(Object.keys(all.counts).length, 0);
  assert.equal(Object.keys(all.errors).length, 6);
});

test("missing, negative, malformed and unsafe counts are errors, not successes", async () => {
  for (const override of [{ omitCount: true }, { count: -1 }, { count: "bad" }, { count: "9007199254740992" }, { throw: true }]) {
    const fixture = countFixture({ respond: () => override });
    const service = await loadSource("services/recruiterDashboardService.js", fixture.mocks);
    const result = await service.fetchRecruiterDashboardStatistics(companyA.id);
    assert.equal(Object.keys(result.counts).length, 0);
    assert.equal(Object.keys(result.errors).length, 6);
  }
});

async function dashboardHarness() {
  const harness = hookHarness();
  let user = { id: "recruiter-a" };
  let companyState = { company: null, isLoading: false, error: "", warning: "" };
  let refreshes = 0;
  const requests = [];
  const { useRecruiterDashboardStatistics } = await loadSource("hooks/useRecruiterDashboardStatistics.js", {
    react: harness.react,
    [source("hooks/useAuth.js")]: { useAuth: () => ({ user }) },
    [source("hooks/useRecruiterCompany.js")]: { useRecruiterCompany: () => ({ ...companyState, refresh() {
      refreshes++; companyState = { ...companyState, company: null, isLoading: true };
    } }) },
    [source("services/recruiterDashboardService.js")]: { fetchRecruiterDashboardStatistics: (companyId) =>
      new Promise((resolve, reject) => requests.push({ companyId, resolve, reject })) },
  });
  return { harness, requests, hook: useRecruiterDashboardStatistics,
    setCompany(company, state = {}) { companyState = { ...companyState, company, isLoading: false, ...state }; },
    setUser(next) { user = next; }, getRefreshes: () => refreshes };
}

test("hook waits for assignment, retains same-scope partial values as stale, and Retry replaces stale zeros", async () => {
  const { harness, hook, requests, setCompany, getRefreshes } = await dashboardHarness();
  assert.equal(harness.render(hook).displayStats.drives, "Unavailable");
  assert.equal(requests.length, 0);
  setCompany(companyA);
  let state = harness.render(hook);
  assert.equal(state.isLoading, true);
  assert.equal(state.displayStats.applications, "Loading...");
  requests[0].resolve({ counts: { ...expected, selected: 0 }, errors: {} });
  state = await harness.settle(hook);
  assert.equal(state.displayStats.selected, 0);
  state.refresh(); state.refresh();
  assert.equal(getRefreshes(), 1);
  state = harness.render(hook);
  assert.equal(state.stats.applications, undefined);
  setCompany({ ...companyA });
  state = harness.render(hook);
  assert.equal(state.displayStats.selected, "0 (refreshing)");
  requests[1].resolve({ counts: { drives: 4, applications: 7, pending: 3, rejected: 2, withdrawn: 2 }, errors: { selected: "Temporarily unavailable" } });
  state = await harness.settle(hook);
  assert.equal(state.displayStats.drives, 4);
  assert.equal(state.displayStats.selected, "0 (stale)");
  assert.match(state.errorMessage, /Selected: Temporarily unavailable/);
  state.refresh(); harness.render(hook); setCompany({ ...companyA }); harness.render(hook);
  requests[2].resolve({ counts: expected, errors: {} });
  state = await harness.settle(hook);
  assert.equal(state.displayStats.selected, 1);
  assert.equal(state.errorMessage, "");
  harness.unmount();
});

test("first-load partial/all failures distinguish unavailable counts from valid zero", async () => {
  const { harness, hook, requests, setCompany } = await dashboardHarness();
  setCompany(companyA); harness.render(hook);
  requests[0].resolve({ counts: { drives: 0 }, errors: { applications: "Denied", pending: "Denied", selected: "Denied", rejected: "Denied", withdrawn: "Denied" } });
  let state = await harness.settle(hook);
  assert.equal(state.displayStats.drives, 0);
  assert.equal(state.displayStats.applications, "Unavailable");
  state.refresh(); harness.render(hook); setCompany({ ...companyA }); harness.render(hook);
  requests[1].reject(new Error("Network unavailable"));
  state = await harness.settle(hook);
  assert.equal(state.displayStats.drives, "0 (stale)");
  assert.equal(state.displayStats.pending, "Unavailable");
  assert.equal(Object.keys(state.errors).length, 6);
  harness.unmount();
});

test("account/company changes and unassigned/error states never expose cached counts or accept late responses", async () => {
  const { harness, hook, requests, setCompany, setUser } = await dashboardHarness();
  setCompany(companyA); harness.render(hook);
  requests[0].resolve({ counts: expected, errors: {} });
  await harness.settle(hook);
  setCompany(companyB);
  let state = harness.render(hook);
  assert.equal(state.stats.applications, undefined);
  assert.equal(state.displayStats.applications, "Loading...");
  setUser({ id: "recruiter-b" });
  state = harness.render(hook);
  assert.equal(state.stats.drives, undefined);
  requests[1].resolve({ counts: { ...expected, applications: 99 }, errors: {} });
  assert.equal((await harness.settle(hook)).stats.applications, undefined);
  requests[2].resolve({ counts: { drives: 1, applications: 2 }, errors: { selected: "Denied" } });
  state = await harness.settle(hook);
  assert.equal(state.displayStats.applications, 2);
  assert.equal(state.displayStats.selected, "Unavailable");
  // Even the same company cannot share cached statistics across logins.
  setUser({ id: "recruiter-c" });
  assert.equal(harness.render(hook).stats.applications, undefined);
  setCompany(null, { warning: "No assignment" });
  state = harness.render(hook);
  assert.equal(state.stats.drives, undefined);
  requests[3].resolve({ counts: expected, errors: {} });
  assert.equal((await harness.settle(hook)).stats.drives, undefined);
  setCompany(null, { error: "Membership denied" });
  state = harness.render(hook);
  assert.equal(state.companyState.error, "Membership denied");
  assert.equal(state.isLoading, false);
  setUser(null);
  assert.equal(harness.render(hook).stats.applications, undefined);
  harness.unmount();
});

test("statistics presentation reuses cards, marks loading/unavailable/stale and offers Retry only", async () => {
  const { default: Statistics } = await loadSource("components/recruiter/RecruiterDashboardStatistics.jsx");
  const render = (props) => renderToStaticMarkup(createElement(Statistics, props));
  const html = render({ displayStats: { ...expected, selected: "1 (stale)", withdrawn: "Unavailable" }, errorMessage: "Selected query failed", onRetry() {} });
  for (const title of ["Total Company Drives", "Total Applicants", "Applied / Pending", "Selected", "Rejected", "Withdrawn"])
    assert.ok(html.includes(title));
  assert.equal((html.match(/class="dashboard-card"/g) || []).length, 6);
  assert.match(html, /1 \(stale\)/);
  assert.match(html, /Unavailable/);
  assert.match(html, /role="alert"/);
  assert.match(html, />Retry</);
  assert.doesNotMatch(html, /<select|<input|Delete|Edit|Update Status/);
  assert.match(render({ displayStats: {}, isLoading: true }), /aria-busy="true"/);
});

test("Recruiter page keeps account UI, hides statistics until assigned and contains no data access", async () => {
  let state = { companyState: { company: null }, displayStats: {}, isLoading: false, refresh() {} };
  const { default: Page } = await loadSource("pages/recruiter/RecruiterDashboard.jsx", {
    "react-router-dom": { useOutletContext: () => ({ fullName: "Recruiter A", email: "recruiter@example.invalid" }), Link: ({ children }) => createElement("a", {}, children) },
    [source("hooks/useRecruiterDashboardStatistics.js")]: { useRecruiterDashboardStatistics: () => state },
  });
  const html = renderToStaticMarkup(createElement(Page));
  assert.match(html, /Recruiter A/);
  assert.doesNotMatch(html, /Total Applicants/);
  state = { ...state, companyState: { company: companyA }, displayStats: expected };
  assert.match(renderToStaticMarkup(createElement(Page)), /Total Applicants/);
  for (const file of ["pages/recruiter/RecruiterDashboard.jsx", "components/recruiter/RecruiterDashboardStatistics.jsx", "hooks/useRecruiterDashboardStatistics.js"]) {
    assert.doesNotMatch(await readFile(source(file), "utf8"), /supabase|\.from\(|\.auth\.|\.storage\.|updateApplicationStatus/, file);
  }
});

test("existing Admin dashboard count service is still unscoped and includes eight original metrics", async () => {
  const calls = [];
  const { fetchDashboardStatistics } = await loadSource("services/dashboardService.js", {
    [source("services/supabaseClient.js")]: { supabase: { from(table) {
      const call = { table }; calls.push(call);
      const query = { select(columns, options) { call.options = options; return query; },
        eq(key, value) { call.filter = [key, value]; return query; },
        then(resolve) { return Promise.resolve({ count: 0, error: null }).then(resolve); } };
      return query;
    } } },
  });
  const { counts, errors } = await fetchDashboardStatistics();
  assert.equal(calls.length, 8);
  assert.equal(Object.keys(counts).length, 8);
  assert.equal(Object.keys(errors).length, 0);
  assert.ok(calls.every((call) => call.options.head && (!call.filter || call.filter[0] === "status")));
});
