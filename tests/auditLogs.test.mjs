import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadSource, source, createReadFixture, hookHarness } from "./helpers/sourceHarness.mjs";
const { AUDIT_ACTION_LABELS } = await loadSource("constants/auditLogs.js");

const events = Array.from({ length: 1101 }, (_, index) => ({
  id: `event-${index}`, actor_profile_id: index % 2 ? "admin-id" : "recruiter-id",
  actor_role: index % 2 ? "admin" : "recruiter", action: "application.status_changed",
  entity_type: "application", entity_id: `application-${index}`, old_status: "Applied",
  new_status: index % 2 ? "Selected" : "Rejected", metadata: { drive_id: "drive-id" },
  created_at: "2026-09-12T12:00:00Z",
}));
const profiles = [{ id: "admin-id", full_name: "Admin" }, { id: "recruiter-id", full_name: "Recruiter" }];

test("audit service reads bounded pages beyond 1,000 rows, with actor names", async () => {
  const f = createReadFixture({ audit_logs: events, profiles });
  const service = await loadSource("services/auditLogsService.js", f.mocks);
  const first = await service.fetchAuditLogs();
  assert.equal(first.events.length, 50);
  assert.equal(first.events[0].actor_name, "Recruiter");
  assert.equal(first.hasNext, true);
  assert.equal(first.warning, "");
  const later = await service.fetchAuditLogs({ page: 20 });
  assert.equal(later.events[0].id, "event-1000");
  const last = await service.fetchAuditLogs({ page: 22 });
  assert.equal(last.events.length, 1);
  assert.equal(last.hasNext, false);
  const reads = f.calls.filter((call) => call.table === "audit_logs");
  assert.deepEqual(reads.map((call) => call.range), [[0, 50], [1000, 1050], [1100, 1150]]);
  assert.deepEqual(reads[0].orders.map(([column, options]) => [column, options.ascending]), [["created_at", false], ["id", false]]);
  assert.ok(f.calls.filter((call) => call.table === "profiles").every((call) => call.ids[1].length <= 50));
});

test("audit action and actor filters execute server-side; invalid options never query", async () => {
  const f = createReadFixture({ audit_logs: events, profiles });
  const service = await loadSource("services/auditLogsService.js", f.mocks);
  for (const action of Object.keys(AUDIT_ACTION_LABELS)) {
    await service.fetchAuditLogs({ action, role: "admin" });
    const read = f.calls.filter((call) => call.table === "audit_logs").at(-1);
    assert.deepEqual(read.filters, [["action", action], ["actor_role", "admin"]]);
  }
  const calls = f.calls.length;
  for (const filter of [{ role: "student" }, { action: "forged" }, { page: -1 }, { page: 1.5 }, { page: Number.MAX_SAFE_INTEGER }]) {
    await assert.rejects(service.fetchAuditLogs(filter), /Invalid/);
  }
  assert.equal(f.calls.length, calls);
});

test("audit read failure is not a valid empty list; actor read failure preserves events with warning", async () => {
  const failed = createReadFixture({ audit_logs: events }, () => new Error("RLS read failed"));
  await assert.rejects((await loadSource("services/auditLogsService.js", failed.mocks)).fetchAuditLogs(), /RLS read failed/);
  const names = createReadFixture({ audit_logs: events }, (call) => call.table === "profiles" ? new Error("Profiles unavailable") : null);
  const result = await (await loadSource("services/auditLogsService.js", names.mocks)).fetchAuditLogs();
  assert.equal(result.events.length, 50);
  assert.match(result.warning, /names could not be loaded/);
  assert.equal(result.events[0].actor_profile_id, "recruiter-id");
  const orphan = createReadFixture({ audit_logs: events });
  const mapped = await (await loadSource("services/auditLogsService.js", orphan.mocks)).fetchAuditLogs();
  assert.match(mapped.warning, /Historical profile IDs/);
  const empty = createReadFixture({ audit_logs: [] });
  assert.equal((await (await loadSource("services/auditLogsService.js", empty.mocks)).fetchAuditLogs()).events.length, 0);
  assert.equal(empty.calls.length, 1, "No actor query for an empty page");
});

test("audit hook handles paging/filter resets/retry and hides previous account data", async () => {
  const h = hookHarness();
  let auth = { user: { id: "admin" }, role: "admin" };
  let fail = false;
  const calls = [];
  const module = await loadSource("hooks/useAuditLogs.js", {
    react: h.react,
    [source("hooks/useAuth.js")]: { useAuth: () => auth },
    [source("services/auditLogsService.js")]: { fetchAuditLogs: async (request) => {
      calls.push(request);
      if (fail) throw new Error("Read failed");
      return { events: events.slice(0, 2), hasNext: true, warning: "" };
    } },
  });
  let state = h.render(module.useAuditLogs);
  assert.equal(state.isLoading, true);
  state = await h.settle(module.useAuditLogs);
  assert.equal(state.events.length, 2);
  state.nextPage();
  h.render(module.useAuditLogs);
  state = await h.settle(module.useAuditLogs);
  assert.equal(state.filters.page, 1);
  state.setFilter("role", "recruiter");
  h.render(module.useAuditLogs);
  state = await h.settle(module.useAuditLogs);
  assert.equal(state.filters.page, 0);
  assert.equal(calls.at(-1).role, "recruiter");
  fail = true;
  state.refresh();
  h.render(module.useAuditLogs);
  state = await h.settle(module.useAuditLogs);
  assert.equal(state.error, "Read failed");
  assert.equal(state.events.length, 0);
  fail = false;
  state.refresh();
  h.render(module.useAuditLogs);
  state = await h.settle(module.useAuditLogs);
  assert.equal(state.events.length, 2);
  const reads = calls.length;
  auth = { user: { id: "student" }, role: "student" };
  state = h.render(module.useAuditLogs);
  assert.equal(state.events.length, 0);
  assert.equal(calls.length, reads);
  h.unmount();
});

test("late audit responses cannot replace a newer filter result", async () => {
  const h = hookHarness();
  const resolves = [];
  const module = await loadSource("hooks/useAuditLogs.js", {
    react: h.react,
    [source("hooks/useAuth.js")]: { useAuth: () => ({ user: { id: "admin" }, role: "admin" }) },
    [source("services/auditLogsService.js")]: { fetchAuditLogs: () => new Promise((resolve) => resolves.push(resolve)) },
  });
  h.render(module.useAuditLogs).setFilter("role", "admin");
  h.render(module.useAuditLogs);
  resolves[1]({ events: [{ id: "current" }] });
  await h.settle(module.useAuditLogs);
  resolves[0]({ events: [{ id: "stale" }] });
  assert.equal((await h.settle(module.useAuditLogs)).events[0].id, "current");
  h.unmount();
});

test("audit UI is read-only, escapes names, displays status history and has explicit empty states", async () => {
  const Table = (await loadSource("components/admin/audit/AuditLogsTable.jsx")).default;
  const html = renderToStaticMarkup(createElement(Table, { events: [{ ...events[0], actor_name: "<script>test</script>" }] }));
  for (const label of ["Timestamp (UTC)", "Application status changed", "Applied to Rejected", "recruiter-id", "drive-id"]) assert.ok(html.includes(label));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.doesNotMatch(html, /<button|<input|<script>/);
  assert.match(renderToStaticMarkup(createElement(Table, { events: [], filtered: true })), /match these filters/);
  const Filters = (await loadSource("components/admin/audit/AuditLogFilters.jsx")).default;
  const filters = renderToStaticMarkup(createElement(Filters, { filters: { action: "", role: "" }, onFilter() {} }));
  for (const label of Object.values(AUDIT_ACTION_LABELS)) assert.ok(filters.includes(label));
  const dates = await loadSource("utils/dates.js");
  assert.equal(dates.formatDateTime("bad"), "Not available");
  assert.equal(dates.formatDateTime("2026-09-12T17:30:00+05:30"), dates.formatDateTime("2026-09-12T12:00:00Z"));
});

test("audit layers contain no client writers and SQL uses only scoped trusted writers", async () => {
  for (const file of ["pages/admin/AuditLogs.jsx", "hooks/useAuditLogs.js", "components/admin/audit/AuditLogFilters.jsx", "components/admin/audit/AuditLogsTable.jsx"]) {
    assert.doesNotMatch(await readFile(source(file), "utf8"), /supabase|\.auth\.|\.storage\./);
  }
  const service = await readFile(source("services/auditLogsService.js"), "utf8");
  assert.doesNotMatch(service, /from ["']react|\.insert\(|\.update\(|\.delete\(/);
  const sql = await readFile(new URL("../supabase/migrations/20260912150000_privileged_audit_logs.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ""), /\b(drop|truncate|cascade)\b/i);
  assert.match(sql, /after update of status on public.applications/);
  assert.match(sql, /when \(old.status is distinct from new.status\)/);
  assert.match(sql, /revoke all on public.audit_logs from public, anon, authenticated, service_role/);
  assert.match(sql, /for select to authenticated[\s\S]*portal_has_role\(array\['admin'\]/);
  assert.doesNotMatch(sql, /create policy[^;]+for (insert|update|delete|all)/i);
});
