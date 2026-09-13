import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement, Suspense } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "vite";
import { createReadFixture, loadSource, source } from "./helpers/sourceHarness.mjs";

test("production build excludes feature pages from initial chunks and stays below the bundle warning", async () => {
  const result = await build({ logLevel: "silent", build: { write: false } });
  const chunks = result.output.filter((item) => item.type === "chunk");
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const initial = new Set();
  function visit(name) {
    if (initial.has(name) || !byName.has(name)) return;
    initial.add(name);
    byName.get(name).imports.forEach(visit);
  }
  chunks.filter((chunk) => chunk.isEntry).forEach((chunk) => visit(chunk.fileName));
  for (const name of initial) {
    for (const id of Object.keys(byName.get(name).modules)) {
      assert.doesNotMatch(id.replaceAll("\\", "/"), /src\/pages\/(admin|student|recruiter)\//);
    }
  }
  assert.equal(chunks.filter((chunk) => chunk.isDynamicEntry && /src\/pages\//.test(chunk.facadeModuleId?.replaceAll("\\", "/"))).length, 18);
  for (const chunk of chunks) assert.ok(Buffer.byteLength(chunk.code) < 500_000, chunk.fileName);
});

test("Admin company/drive lists paginate, map later-page companies and preserve empty results", async () => {
  const companies = Array.from({ length: 1205 }, (_, id) => ({ id: `c${id}`, company_name: `Company ${id}` }));
  const placement_drives = companies.map((company, id) => ({ id: `d${id}`, company_id: company.id }));
  const fixture = createReadFixture({ companies, placement_drives });
  const companyService = await loadSource("services/companiesService.js", fixture.mocks);
  assert.equal((await companyService.fetchCompanies()).length, 1205);
  assert.deepEqual(fixture.calls.map((call) => call.range), [[0, 999], [1000, 1999]]);
  fixture.calls.length = 0;
  const drivesService = await loadSource("services/drivesService.js", fixture.mocks);
  const data = await drivesService.fetchDriveManagementData();
  assert.equal(data.drives.length, 1205);
  assert.equal(data.companies.length, 1205);
  assert.equal(data.drives[1204].company_name, "Company 1204");
  assert.equal(data.drives[1204].hasKnownCompany, true);
  assert.equal(fixture.calls.length, 4); // Two pages/table, never one query/drive.
  for (const call of fixture.calls) assert.equal(call.orders[1][0], "id");
  const empty = createReadFixture({});
  assert.equal((await (await loadSource("services/companiesService.js", empty.mocks)).fetchCompanies()).length, 0);
  assert.equal((await (await loadSource("services/drivesService.js", empty.mocks)).fetchDriveManagementData()).drives.length, 0);
});

test("later-page failures never masquerade as complete Admin lists", async () => {
  const rows = Array.from({ length: 1000 }, (_, id) => ({ id }));
  for (const failedTable of ["companies", "placement_drives"]) {
    const fixture = createReadFixture({ companies: rows, placement_drives: rows },
      (call) => call.table === failedTable && call.range?.[0] === 1000 ? new Error("page denied") : null);
    const drives = await loadSource("services/drivesService.js", fixture.mocks);
    await assert.rejects(drives.fetchDriveManagementData(), /page denied/);
    if (failedTable === "companies") {
      const companies = await loadSource("services/companiesService.js", fixture.mocks);
      await assert.rejects(companies.fetchCompanies(), /page denied/);
    }
  }
});

test("overlapping auth-profile reads deduplicate per user, with no resolved-role or error cache", async () => {
  const requests = [];
  const supabase = { from(table) {
    assert.equal(table, "profiles");
    const query = {
      select() { return query; },
      eq(column, id) { assert.equal(column, "id"); query.id = id; return query; },
      single() { return new Promise((resolve) => requests.push({ id: query.id, resolve })); },
    };
    return query;
  } };
  const service = await loadSource("services/authService.js", { [source("services/supabaseClient.js")]: { supabase } });
  const first = service.getAuthProfile("a");
  const overlapping = service.getAuthProfile("a");
  const third = service.getAuthProfile("a");
  assert.equal(requests.length, 1);
  assert.equal(first, overlapping);
  assert.equal(first, third);
  const otherUser = service.getAuthProfile("b");
  assert.equal(requests.length, 2);
  requests[0].resolve({ data: { id: "a", role: "admin" } });
  requests[1].resolve({ data: { id: "b", role: "student" } });
  assert.equal((await first).role, "admin");
  assert.equal((await otherUser).id, "b");
  const fresh = service.getAuthProfile("a");
  assert.equal(requests.length, 3);
  requests[2].resolve({ data: { id: "a", role: "student" } });
  assert.equal((await fresh).role, "student");
  const failed = service.getAuthProfile("a");
  requests[3].resolve({ error: new Error("profile denied") });
  await assert.rejects(failed, /profile denied/);
  const retry = service.getAuthProfile("a");
  assert.equal(requests.length, 5);
  requests[4].resolve({ data: { id: "a", role: "student" } });
  await retry;
});

test("all 18 feature pages are lazy, route declarations do not invoke loaders, guards stay unchanged", async () => {
  const text = await readFile(source("routes/AppRoutes.jsx"), "utf8");
  const loaders = [];
  const mocks = { react: { ...React, lazy: (loader) => {
    loaders.push(loader);
    return function DeferredPage() {};
  } } };
  for (const match of text.matchAll(/from "(\.\.\/(?:pages|layouts)\/[^\"]+)"/g)) {
    mocks[path.resolve(path.dirname(source("routes/AppRoutes.jsx")), `${match[1]}.jsx`)] = { default() {} };
  }
  mocks[source("routes/RouteContent.jsx")] = { default() {} };
  const { default: Routes } = await loadSource("routes/AppRoutes.jsx", mocks);
  const branches = Routes().props.children.props.children;
  assert.equal(loaders.length, 18);
  assert.doesNotMatch(text, /from "\.\.\/pages\/(?:student|admin|recruiter)\//);
  for (const [role, count] of [["student", 4], ["admin", 8], ["recruiter", 4]]) {
    const guard = branches.find((route) => route.props.element?.props.allowedRoles?.includes(role));
    assert.equal(guard.props.children.props.path, `/${role}`);
    assert.equal(guard.props.children.props.children.filter((route) => route.props.path).length, count);
  }
  for (const layout of ["Admin", "Student", "Recruiter"]) {
    assert.match(await readFile(source(`layouts/${layout}Layout.jsx`), "utf8"), /<RouteContent><Outlet/);
  }
});

test("route boundary has accessible loading, reload recovery and resets on navigation", async () => {
  let pathname = "/admin/dashboard";
  let reloads = 0;
  const { default: Content } = await loadSource("routes/RouteContent.jsx", {
    "react-router-dom": { useLocation: () => ({ pathname }) },
  }, { window: { location: { reload: () => reloads++ } } });
  const element = Content({ children: "Page" });
  assert.equal(element.props.children.type, Suspense);
  const loading = renderToStaticMarkup(element.props.children.props.fallback);
  assert.match(loading, /role="status"/);
  assert.match(loading, /Loading page/);
  const Boundary = element.type;
  const boundary = new Boundary({ children: "Page" });
  assert.equal(boundary.render(), "Page");
  boundary.state = Boundary.getDerivedStateFromError(new Error("Chunk unavailable"));
  const feedback = boundary.render();
  assert.match(renderToStaticMarkup(feedback), /role="alert"/);
  feedback.props.children[1].props.onClick();
  assert.equal(reloads, 1);
  pathname = "/admin/students";
  assert.notEqual(Content({ children: createElement("p") }).key, element.key);
});
