// Run: node --experimental-vm-modules --test tests/*.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { source, loadSource, createReadFixture, hookHarness } from "./helpers/sourceHarness.mjs";

const company = { id: "company-a", company_name: "Company A" };
const drive = { id: "drive-a", company_id: company.id, role: "Engineer" };
const profile = { id: "profile-a", role: "student", full_name: "Student A", email: "student@example.invalid" };
const student = { id: "student-a", profile_id: profile.id, branch: "CSE", cgpa: 0, graduation_year: 2030,
  skills: "React, SQL", roll_number: "R01", resume_url: "profile-a/resume.pdf" };
const application = { id: "application-a", student_id: student.id, drive_id: drive.id, status: "Applied", applied_at: "2030-01-15T12:00:00" };
const tables = { placement_drives: [drive, { ...drive, id: "other-drive", company_id: "company-b" }],
  applications: [application, { ...application, id: "other-application", drive_id: "other-drive", student_id: "other-student" }],
  students: [student, { ...student, id: "other-student", profile_id: "other-profile" }], profiles: [profile] };
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));

test("scoped service reuses drives, ID-batched student/profile reads and never signs at load", async () => {
  const fixture = createReadFixture(tables);
  const service = await loadSource("services/recruiterApplicantsService.js", fixture.mocks);
  const data = await service.fetchRecruiterApplicants(company);
  assert.equal(data.applications.length, 1);
  assert.equal(data.applications[0].student_name, profile.full_name);
  assert.equal(data.applications[0].student.resume_path, student.resume_url);
  assert.equal(data.applications[0].student.cgpa, 0);
  assert.equal(data.applications[0].company_name, company.company_name);
  assert.equal(data.warnings.length, 0);
  for (const call of fixture.calls.filter((call) => ["students", "profiles"].includes(call.table))) {
    assert.equal(call.ids[0], "id");
    assert.equal(call.ids[1].length, 1);
    assert.ok(!call.ids[1].includes("other-student"));
  }
  const count = fixture.calls.length;
  assert.equal((await service.fetchRecruiterApplicants(null)).applications.length, 0);
  assert.equal((await service.fetchRecruiterApplicants({ id: "no-drives" })).applications.length, 0);
  assert.equal(fixture.calls.length, count + 1);
});

test("all 1205 applications and related profiles load beyond 1000 with drive filters on every page", async () => {
  const applications = Array.from({ length: 1205 }, (_, i) => ({ ...application, id: `app-${i}`, student_id: `student-${i}` }));
  const students = applications.map((app, i) => ({ ...student, id: app.student_id, profile_id: `profile-${i}` }));
  const profiles = students.map((row) => ({ ...profile, id: row.profile_id }));
  const fixture = createReadFixture({ ...tables, applications: [...applications, tables.applications[1]], students, profiles });
  const { fetchRecruiterApplicants } = await loadSource("services/recruiterApplicantsService.js", fixture.mocks);
  const data = await fetchRecruiterApplicants(company);
  assert.equal(data.applications.length, 1205);
  assert.ok(data.applications.every((app) => app.hasProfile));
  const reads = fixture.calls.filter((call) => call.table === "applications");
  assert.deepEqual(reads.map((call) => call.range), [[0, 999], [1000, 1999]]);
  for (const call of reads) {
    assert.deepEqual(Array.from(call.ids[1]), [drive.id]);
    assert.equal(call.orders[1][0], "id");
  }
  for (const table of ["students", "profiles"]) {
    const calls = fixture.calls.filter((call) => call.table === table);
    assert.equal(calls.length, 13);
    assert.ok(calls.every((call) => call.ids[1].length <= 100));
  }
});

test("more than 100 drive IDs are batched without losing applications", async () => {
  const drives = Array.from({ length: 105 }, (_, i) => `drive-${i}`);
  const rows = drives.map((id, i) => ({ ...application, id: `app-${i}`, drive_id: id }));
  const fixture = createReadFixture({ applications: rows });
  const service = await loadSource("services/applicationsService.js", fixture.mocks);
  assert.equal((await service.fetchApplicationsForDrives(drives)).length, 105);
  assert.deepEqual(fixture.calls.map((call) => call.ids[1].length), [100, 5]);
  assert.equal((await service.fetchApplicationsForDrives([])).length, 0);
  assert.equal(fixture.calls.length, 2);
});

test("later-page and relationship read failures never become empty/partial successes", async () => {
  for (const failingTable of ["placement_drives", "applications", "students", "profiles"]) {
    const fixture = createReadFixture(tables, (call) => call.table === failingTable ? new Error(`${failingTable} denied`) : null);
    const service = await loadSource("services/recruiterApplicantsService.js", fixture.mocks);
    await assert.rejects(service.fetchRecruiterApplicants(company), /denied/);
  }
  const fixture = createReadFixture({ ...tables, applications: Array.from({ length: 1000 }, (_, id) => ({ ...application, id })) },
    (call) => call.table === "applications" && call.range?.[0] === 1000 ? new Error("Later page failed") : null);
  const service = await loadSource("services/recruiterApplicantsService.js", fixture.mocks);
  await assert.rejects(service.fetchRecruiterApplicants(company), /Later page/);
});

test("mapping fails closed for unknown/cross-company drives and warns for missing student/profile", async () => {
  const { mapRecruiterApplicants } = await loadSource("utils/recruiterApplicants.js");
  const mapped = { ...student, full_name: profile.full_name, email: "", hasProfile: false };
  const rows = [application, { ...application, id: "missing-student", student_id: "absent" },
    { ...application, id: "orphan-drive", drive_id: "missing-drive" }, tables.applications[1]];
  const result = mapRecruiterApplicants(rows, [mapped], tables.placement_drives, company);
  assert.equal(result.applications.length, 2);
  assert.ok(result.warnings.some((warning) => /missing student/.test(warning)));
  assert.ok(result.warnings.some((warning) => /missing profile/.test(warning)));
  assert.ok(result.warnings.some((warning) => /excluded/.test(warning)));
  assert.equal(result.applications.find((app) => app.id === "missing-student").student, null);
});

test("drive and status filters preserve all statuses and never count Withdrawn/unknown as Applied", async () => {
  const { filterRecruiterApplicants, canPreviewApplicantResume } = await loadSource("utils/recruiterApplicants.js");
  const statuses = ["Applied", "Selected", "Rejected", "Withdrawn", "unexpected"];
  const rows = statuses.flatMap((status) => [drive.id, "second-drive"].map((drive_id) => ({ ...application, status, drive_id,
    student: { ...student, resume_path: student.resume_url } })));
  assert.equal(filterRecruiterApplicants(rows, "", "").length, 10);
  for (const status of statuses.slice(0, 4)) {
    assert.equal(filterRecruiterApplicants(rows, "", status).length, 2);
    assert.equal(filterRecruiterApplicants(rows, drive.id, status).length, 1);
  }
  assert.equal(filterRecruiterApplicants(rows, "not-found", "").length, 0);
  for (const row of rows) assert.equal(canPreviewApplicantResume(row), ["Applied", "Selected"].includes(row.status));
});

test("existing Admin application mapping and Student directory retain their data semantics", async () => {
  const fixture = createReadFixture({ ...tables, companies: [company] });
  const admin = await loadSource("services/applicationsService.js", fixture.mocks);
  const result = await admin.fetchApplicationsData();
  assert.equal(result.error, null);
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].student_name, profile.full_name);
  const students = await loadSource("services/studentsService.js", fixture.mocks);
  const directory = await students.fetchStudentDirectory();
  assert.equal(directory.length, 2);
  assert.equal(directory[0].full_name, profile.full_name);
  assert.equal(directory[0].resume_url, student.resume_url);
  assert.equal(directory[0].resume_path, student.resume_url);
});

test("feature hook handles loading, filters, paging, details, refresh, stale scope and errors", async () => {
  const harness = hookHarness();
  let companyState = { company: null, isLoading: false, refresh() { companyState = { ...companyState, company: null, isLoading: true }; } };
  const requests = [];
  const { useRecruiterApplicants } = await loadSource("hooks/useRecruiterApplicants.js", {
    react: harness.react,
    [source("hooks/useRecruiterCompany.js")]: { useRecruiterCompany: () => companyState },
    [source("hooks/useRecruiterApplicantResume.js")]: { useRecruiterApplicantResume: () => ({}) },
    [source("services/recruiterApplicantsService.js")]: { decideRecruiterApplication() {}, fetchRecruiterApplicants: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) },
  });
  const hook = useRecruiterApplicants;
  assert.equal(harness.render(hook).total, 0);
  assert.equal(requests.length, 0);
  companyState = { ...companyState, company };
  assert.equal(harness.render(hook).isLoading, true);
  const rows = Array.from({ length: 53 }, (_, i) => ({ ...application, id: `app-${i}`, status: i % 2 ? "Withdrawn" : "Applied" }));
  requests[0].resolve({ applications: rows, drives: [drive], warnings: ["Fixture warning"] });
  let state = await harness.settle(hook);
  assert.equal(state.matching, 53);
  assert.equal(state.applications.length, 25);
  state.changePage(3); state = harness.render(hook);
  assert.equal(state.applications.length, 3);
  state.toggleDetails("app-50"); state = harness.render(hook);
  assert.equal(state.expandedId, "app-50");
  state.changeFilters({ driveId: drive.id, status: "Withdrawn" }); state = harness.render(hook);
  assert.equal(state.matching, 26);
  assert.equal(state.page, 1);
  assert.equal(state.expandedId, null);
  state.clearFilters(); state = harness.render(hook);
  assert.equal(state.matching, 53);
  state.refresh(); assert.equal(harness.render(hook).total, 0);
  companyState = { ...companyState, company: { ...company }, isLoading: false };
  harness.render(hook);
  companyState = { ...companyState, company: { id: "company-b" } };
  assert.equal(harness.render(hook).applications.length, 0);
  requests[1].resolve({ applications: rows, drives: [drive] });
  assert.equal((await harness.settle(hook)).total, 0);
  requests[2].reject(new Error("RLS read failed"));
  state = await harness.settle(hook);
  assert.match(state.error, /RLS read failed/);
  assert.equal(state.isLoading, false);
  harness.unmount();
});

test("resume signing is lazy, expires, reports denial and clears cached links on scope change", async () => {
  const harness = hookHarness();
  let scope = {};
  let now = 1000;
  const calls = [];
  const windows = [];
  const { useRecruiterApplicantResume } = await loadSource("hooks/useRecruiterApplicantResume.js", {
    react: harness.react,
    [source("services/resumeService.js")]: { getTimedResumeAccess: (path) => new Promise((resolve, reject) => calls.push({ path, resolve, reject })) },
  }, { Date: { now: () => now }, window: { open() { const tab = { close() { tab.closed = true; }, location: { replace(url) { tab.url = url; } } }; windows.push(tab); return tab; } } });
  const hook = () => useRecruiterApplicantResume(scope);
  const row = { ...application, student: { ...student, resume_path: student.resume_url } };
  let prevented = 0;
  const event = { preventDefault() { prevented++; } };
  let state = harness.render(hook);
  assert.equal(calls.length, 0);
  const opening = state.openResume(row, event);
  assert.equal(calls.length, 1);
  state = harness.render(hook);
  assert.equal(state.openingStudentId, student.id);
  await state.openResume(row, event);
  assert.equal(calls.length, 1);
  calls[0].resolve({ path: student.resume_url, url: "https://example.invalid/signed", expiresAt: 2000 });
  await opening;
  state = harness.render(hook);
  assert.equal(windows[0].url, "https://example.invalid/signed");
  const before = prevented;
  await state.openResume(row, event);
  assert.equal(prevented, before);
  now = 3000;
  const renewal = state.openResume(row, event);
  calls[1].reject(new Error("Object not found or access denied")); await renewal;
  state = harness.render(hook);
  assert.match(state.error, /access denied/);
  assert.equal(state.access, null);
  assert.equal(windows[1].closed, true);
  await state.openResume({ ...row, status: "Withdrawn" }, event);
  assert.equal(calls.length, 2);
  const stale = state.openResume(row, event);
  scope = {}; state = harness.render(hook);
  assert.equal(state.access, null);
  calls[2].resolve({ path: student.resume_url, url: "https://example.invalid/stale", expiresAt: 9000 }); await stale;
  assert.equal(harness.render(hook).access, null);
  assert.equal(windows[2].closed, true);
  harness.unmount();
});

test("presentational table/details include required fields, clear empty states and no mutations", async () => {
  const { default: Table } = await loadSource("components/recruiter/RecruiterApplicantsTable.jsx");
  const { default: Details } = await loadSource("components/recruiter/RecruiterApplicantDetails.jsx");
  const { default: Filters } = await loadSource("components/recruiter/RecruiterApplicantFilters.jsx");
  const row = { ...application, student_name: profile.full_name, email: profile.email, company_name: company.company_name,
    role: drive.role, student: { ...student, full_name: profile.full_name, email: profile.email, resume_path: student.resume_url } };
  const resume = { openResume() {} };
  const html = render(Table, { applications: [row], total: 1, expandedId: row.id, onToggleDetails() {}, resume });
  for (const field of ["Student A", profile.email, "R01", "CSE", "CGPA: 0", "2030", "Company A", "Engineer", "15 Jan 2030", "Applied", "React, SQL", "View Resume"])
    assert.ok(html.includes(field), field);
  assert.match(html, /aria-expanded="true"/);
  assert.doesNotMatch(html, /<select|<input|Delete|Edit|Update Status|Select Applicant/);
  assert.doesNotMatch(html, /profile-a\/resume.pdf/);
  assert.match(render(Details, { application: { ...row, status: "Withdrawn" }, resume }), /Resume access is unavailable/);
  assert.match(render(Details, { application: { ...row, student: null }, resume }), /no longer authorized/);
  assert.match(render(Table, { applications: [], total: 0 }), /No applications for your company/);
  assert.match(render(Table, { applications: [], total: 1 }), /No applications match/);
  const filters = render(Filters, { drives: [drive], companyName: company.company_name, filters: { driveId: "", status: "" }, onChange() {}, onClear() {} });
  assert.match(filters, /Applied \(Pending\)/);
  assert.match(filters, /Withdrawn/);
});

test("page and components contain no direct data calls or status update imports", async () => {
  for (const file of ["pages/recruiter/RecruiterApplicants.jsx", "hooks/useRecruiterApplicants.js", "hooks/useRecruiterApplicantResume.js",
    "components/recruiter/RecruiterApplicantFilters.jsx", "components/recruiter/RecruiterApplicantsTable.jsx", "components/recruiter/RecruiterApplicantDetails.jsx"])
    assert.doesNotMatch(await readFile(source(file), "utf8"), /supabase|\.from\(|\.auth\.|\.storage\.|updateApplicationStatus|ApplicationStatusControl/, file);
  const page = await readFile(source("pages/recruiter/RecruiterApplicants.jsx"), "utf8");
  assert.ok(page.split("\n").length < 80);
});

test("existing resume service signs only private normalized paths with an expiring URL", async () => {
  const calls = [];
  const { getTimedResumeAccess } = await loadSource("services/resumeService.js", {
    [source("services/supabaseClient.js")]: { supabase: { storage: { from(bucket) {
      return { async createSignedUrl(path, lifetime) {
        calls.push({ bucket, path, lifetime });
        return { data: { signedUrl: "https://example.invalid/secure-resume" }, error: null };
      } };
    } } } },
  });
  assert.equal(calls.length, 0);
  const access = await getTimedResumeAccess("https://example.invalid/storage/v1/object/public/resumes/profile-a/resume.pdf");
  assert.deepEqual(calls, [{ bucket: "resumes", path: "profile-a/resume.pdf", lifetime: 3600 }]);
  assert.equal(access.path, "profile-a/resume.pdf");
  assert.equal(access.url, "https://example.invalid/secure-resume");
  assert.ok(access.expiresAt > Date.now());
  await assert.rejects(getTimedResumeAccess(""), /unavailable/);
  assert.equal(calls.length, 1);
});
