import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { source, loadSource, hookHarness } from "./helpers/sourceHarness.mjs";

const company = { id: "company-a", company_name: "Company A" };
const row = { id: "app-a", drive_id: "drive-a", student_name: "Fixture Student", role: "Engineer", status: "Applied" };

function decisionFixture(response) {
  const calls = [];
  const query = {
    update(payload) { calls.push(["update", payload]); return this; },
    eq(key, value) { calls.push(["eq", key, value]); return this; },
    select(columns) { calls.push(["select", columns]); return this; },
    async maybeSingle() { return response; },
  };
  return { calls, mocks: { [source("services/supabaseClient.js")]: {
    supabase: { from(table) { assert.equal(table, "applications"); return query; } },
  } } };
}

test("decision service changes only status and requires matching row/drive/Applied", async () => {
  for (const status of ["Selected", "Rejected"]) {
    const data = { id: row.id, drive_id: row.drive_id, status };
    const fixture = decisionFixture({ data, error: null });
    const { decideRecruiterApplication } = await loadSource("services/recruiterApplicantsService.js", fixture.mocks);
    assert.equal(await decideRecruiterApplication(row.id, row.drive_id, status), data);
    assert.deepEqual(JSON.parse(JSON.stringify(fixture.calls)), [
      ["update", { status }], ["eq", "id", row.id], ["eq", "drive_id", row.drive_id],
      ["eq", "status", "Applied"], ["select", "id, drive_id, status"],
    ]);
  }
});

test("decision service rejects invalid targets, RLS no-ops, errors and mismatched results", async () => {
  const invalid = decisionFixture({ data: null });
  const service = await loadSource("services/recruiterApplicantsService.js", invalid.mocks);
  for (const status of ["Applied", "Withdrawn", null, "selected"]) {
    await assert.rejects(service.decideRecruiterApplication(row.id, row.drive_id, status), /Select or reject/);
  }
  await assert.rejects(service.decideRecruiterApplication(null, row.drive_id, "Selected"), /existing/);
  assert.equal(invalid.calls.length, 0);
  for (const response of [
    { data: null, error: null },
    { data: null, error: new Error("RLS denied") },
    { data: { id: "wrong", drive_id: row.drive_id, status: "Selected" } },
    { data: { id: row.id, drive_id: "wrong", status: "Selected" } },
    { data: { id: row.id, drive_id: row.drive_id, status: "Applied" } },
  ]) {
    const { decideRecruiterApplication } = await loadSource("services/recruiterApplicantsService.js", decisionFixture(response).mocks);
    await assert.rejects(decideRecruiterApplication(row.id, row.drive_id, "Selected"), /not updated|RLS denied|could not be verified/);
  }
});

async function setupHook() {
  const harness = hookHarness();
  let companyState = { company, isLoading: false, refresh() {} };
  let confirms = true;
  const confirmations = [];
  const requests = [];
  const { useRecruiterApplicants } = await loadSource("hooks/useRecruiterApplicants.js", {
    react: harness.react,
    [source("hooks/useRecruiterCompany.js")]: { useRecruiterCompany: () => companyState },
    [source("hooks/useRecruiterApplicantResume.js")]: { useRecruiterApplicantResume: (scope) => ({ scope }) },
    [source("services/recruiterApplicantsService.js")]: {
      fetchRecruiterApplicants: async () => ({ applications: [row], drives: [{ id: row.drive_id }], warnings: [] }),
      decideRecruiterApplication: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })),
    },
  }, { window: { confirm(message) { confirmations.push(message); return confirms; } } });
  const render = () => harness.render(useRecruiterApplicants);
  const settle = () => harness.settle(useRecruiterApplicants);
  render();
  await settle();
  return { harness, render, settle, requests, confirmations,
    confirm(value) { confirms = value; }, changeCompany(value) { companyState = { ...companyState, company: value }; } };
}

test("confirmation cancellation does not write; success updates filters, count and existing details", async () => {
  for (const status of ["Selected", "Rejected"]) {
    const fixture = await setupHook();
    let state = fixture.render();
    fixture.confirm(false);
    await state.decideApplication(row, status);
    assert.equal(fixture.requests.length, 0);
    fixture.confirm(true);
    state.toggleDetails(row.id);
    state = fixture.render();
    const previousResumeScope = state.resume.scope;
    const pending = state.decideApplication(row, status);
    await state.decideApplication(row, status);
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.render().updatingId, row.id);
    fixture.requests[0].resolve({ id: row.id, drive_id: row.drive_id, status });
    await pending;
    state = fixture.render();
    assert.equal(state.applications[0].id, row.id);
    assert.equal(state.applications[0].status, status);
    assert.equal(state.expandedId, row.id);
    assert.notEqual(state.resume.scope, previousResumeScope, "Decision invalidates cached signed resume access");
    assert.equal(state.total, 1);
    assert.equal(state.updatingId, null);
    assert.match(state.success, new RegExp(status));
    await state.decideApplication(state.applications[0], "Selected");
    assert.equal(fixture.requests.length, 1);
    state.changeFilters({ driveId: "", status: "Applied" });
    assert.equal(fixture.render().matching, 0);
    state.changeFilters({ driveId: "", status });
    assert.equal(fixture.render().matching, 1);
    fixture.harness.unmount();
  }
});

test("failed decision keeps previous row and provides friendly error for reload", async () => {
  const fixture = await setupHook();
  const pending = fixture.render().decideApplication(row, "Rejected");
  fixture.requests[0].reject(new Error("APPLICATION_STATUS_TRANSITION_DENIED: Reload to check current status."));
  await pending;
  const state = fixture.render();
  assert.equal(state.applications[0].status, "Applied");
  assert.equal(state.success, "");
  assert.equal(state.updatingId, null);
  assert.equal(state.decisionError, "Reload to check current status.");
  fixture.harness.unmount();
});

test("company/session change or unmount discards late decision results", async () => {
  for (const unmount of [false, true]) {
    const fixture = await setupHook();
    const pending = fixture.render().decideApplication(row, "Selected");
    if (unmount) fixture.harness.unmount();
    else { fixture.changeCompany(null); fixture.render(); }
    fixture.requests[0].resolve({ id: row.id, drive_id: row.drive_id, status: "Selected" });
    await pending;
    const state = fixture.render();
    assert.equal(state.success, "");
    assert.ok(!state.applications.some((application) => application.status === "Selected"));
    fixture.harness.unmount();
  }
});

test("decision component has Select/Reject only for Applied, disables duplicate clicks", async () => {
  const { default: Decision } = await loadSource("components/recruiter/RecruiterApplicantDecision.jsx");
  const render = (status, updatingId) => renderToStaticMarkup(createElement(Decision, {
    application: { ...row, status }, onDecision() {}, updatingId,
  }));
  for (const status of ["Selected", "Rejected", "Withdrawn", null, "unknown"]) assert.equal(render(status), "");
  assert.match(render("Applied"), />Select</);
  assert.match(render("Applied"), />Reject</);
  assert.match(render("Applied", row.id), /Saving/);
  assert.equal((render("Applied", row.id).match(/disabled=""/g) || []).length, 2);
  assert.doesNotMatch(render("Applied"), /Edit|Delete|Withdraw|Re-apply/);
  const callbacks = [];
  const element = Decision({ application: row, onDecision: (...args) => callbacks.push(args) });
  for (const button of element.props.children.filter((child) => child?.type === "button")) button.props.onClick();
  assert.deepEqual(callbacks, [[row, "Selected"], [row, "Rejected"]]);
});

test("decision keeps data access out of recruiter page/hook/components", async () => {
  for (const file of ["pages/recruiter/RecruiterApplicants.jsx", "hooks/useRecruiterApplicants.js",
    "components/recruiter/RecruiterApplicantsTable.jsx", "components/recruiter/RecruiterApplicantDecision.jsx"]) {
    assert.doesNotMatch(await readFile(source(file), "utf8"), /supabase|\.from\(|\.auth\.|\.storage\./);
  }
  const migration = await readFile(new URL("../supabase/migrations/20260912120000_recruiter_applicant_decisions.sql", import.meta.url), "utf8");
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|CASCADE)\b/i);
  assert.doesNotMatch(migration, /grant\s+(update|insert|delete)/i);
});
