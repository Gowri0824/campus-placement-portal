import test from "node:test";
import assert from "node:assert/strict";
import { createInviteHandler } from "../supabase/functions/invite-recruiter/handler.js";
import { validateRecruiterInvitation } from "../shared/recruiterInvitation.js";
import { validateSetupPassword, getPasswordLinkError } from "../src/utils/passwordSetup.js";
import { loadSource, source, createReadFixture, hookHarness } from "./helpers/sourceHarness.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const COMPANY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = { fullName: "Test Recruiter", email: "new@example.invalid", companyId: COMPANY };
function fixture(options = {}) {
  const calls = [];
  let user = options.target ? { id: "existing", app_metadata: { portal_recruiter_invite: "old-request" } } : null;
  let stored = Boolean(options.target && !options.incomplete);
  let provisionAttempts = 0;
  const client = {
    auth: {
      async getUser(token) { calls.push("verify-token"); return token === "valid"
        ? { data: { user: { id: "admin-id" } } } : { error: new Error("invalid") }; },
      admin: {
        async createUser(details) {
          calls.push("create-auth");
          assert.equal(details.email_confirm, false);
          assert.equal(details.password, undefined);
          if (options.createFails) return { error: { status: 422 } };
          user = { id: "new-user", app_metadata: details.app_metadata };
          return { data: { user } };
        },
        async getUserById() { return { data: { user: { ...user, email_confirmed_at: options.confirmedDuringCleanup ? "now" : null } } }; },
        async deleteUser(id) { calls.push("delete-auth"); assert.equal(id, "new-user"); return options.cleanupFails ? { error: {} } : {}; },
        async inviteUserByEmail(email, { redirectTo }) {
          calls.push("send-invite");
          assert.ok(stored, "Email must follow successful database provisioning");
          assert.equal(email, input.email);
          assert.equal(redirectTo, "https://portal.example/auth/setup-password");
          if (options.emailFails) throw new Error("SMTP unavailable");
          return { data: { user } };
        },
      },
    },
    from(table) {
      let columns;
      const query = {
        select(value) { columns = value; return query; }, eq() { return query; },
        async maybeSingle() {
          if (columns === "role") return { data: { role: options.role || "admin" }, error: options.roleReadFails ? {} : null };
          if (options.cleanupReadFails) return { error: {} };
          return { data: stored && table === "profiles" ? { id: user.id } : null };
        },
      };
      return query;
    },
    async rpc(name, args) {
      calls.push(name);
      assert.equal(args.p_admin_id, "admin-id");
      if (name === "portal_recruiter_invite_target") {
        if (options.conflict) return { error: { code: "23505", message: "Existing account" } };
        return { data: options.target ? { user_id: "existing", request_id: "old-request" } : { user_id: null } };
      }
      provisionAttempts++;
      if (options.transportFails) throw new Error("Network timeout");
      if (options.provisionFails) return { error: { code: "23503", message: "Company deleted" } };
      stored = true;
      if (options.lostResponse && provisionAttempts === 1) throw new Error("response lost");
      return { data: user.id };
    },
  };
  const handle = createInviteHandler({ client, siteUrl: "https://portal.example" });
  async function invoke(token = "valid", body = input, origin = "https://portal.example") {
    const response = await handle(new Request("https://edge.example/invite-recruiter", {
      method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Origin: origin },
      body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  }
  return { calls, invoke, handle };
}

test("validates normalized input and rejects malformed details", () => {
  assert.deepEqual(validateRecruiterInvitation({ ...input, email: " NEW@EXAMPLE.INVALID ", role: "admin" }).value, input);
  for (const invalid of [null, [], { ...input, fullName: "\n" }, { ...input, email: "bad" }, { ...input, companyId: "all" }]) {
    assert.ok(validateRecruiterInvitation(invalid).error);
  }
});
for (const role of ["student", "recruiter"]) test(`${role} cannot provision or call Auth Admin`, async () => {
  const f = fixture({ role });
  assert.equal((await f.invoke()).status, 403);
  assert.deepEqual(f.calls, ["verify-token"]);
});
for (const token of [null, "forged"]) test(`${token || "anonymous"} token denied`, async () => {
  const f = fixture();
  assert.equal((await f.invoke(token)).status, 401);
  assert.ok(!f.calls.includes("create-auth"));
});
test("role read failure fails closed", async () => {
  const f = fixture({ roleReadFails: true });
  assert.equal((await f.invoke()).status, 503);
  assert.ok(!f.calls.includes("create-auth"));
});
test("body cannot claim an admin role and an untrusted origin is denied", async () => {
  assert.equal((await fixture({ role: "student" }).invoke("valid", { ...input, role: "admin" })).status, 403);
  const f = fixture();
  assert.equal((await f.invoke("valid", input, "https://attacker.example")).status, 403);
  assert.equal(f.calls.length, 0);
});
test("Admin provisions database before sending invite", async () => {
  const f = fixture();
  const result = await f.invoke();
  assert.equal(result.status, 200);
  assert.equal(result.body.invited, true);
  assert.deepEqual(f.calls, ["verify-token", "portal_recruiter_invite_target", "create-auth", "portal_provision_recruiter", "send-invite"]);
  assert.ok(!JSON.stringify(result.body).includes("token"));
});
test("incompatible email and create race cannot convert/delete existing accounts", async () => {
  const conflict = fixture({ conflict: true });
  assert.equal((await conflict.invoke()).status, 409);
  assert.ok(!conflict.calls.includes("create-auth"));
  const race = fixture({ createFails: true });
  assert.equal((await race.invoke()).status, 409);
  assert.ok(!race.calls.includes("delete-auth"));
});
test("lost database response is safely retried before email", async () => {
  const f = fixture({ lostResponse: true });
  assert.equal((await f.invoke()).body.invited, true);
  assert.equal(f.calls.filter((call) => call === "portal_provision_recruiter").length, 2);
});
test("database failure removes only the newly-created, unprovisioned account", async () => {
  const f = fixture({ provisionFails: true });
  assert.equal((await f.invoke()).body.code, "PROVISIONING_ROLLED_BACK");
  assert.ok(f.calls.includes("delete-auth"));
  assert.ok(!f.calls.includes("send-invite"));
});
for (const option of ["target", "cleanupReadFails", "confirmedDuringCleanup"]) {
  test(`unsafe compensation is refused: ${option}`, async () => {
    const f = fixture({ provisionFails: true, [option]: true });
    assert.equal((await f.invoke()).body.code, "PROVISIONING_REQUIRES_REVIEW");
    assert.ok(!f.calls.includes("delete-auth"));
  });
}
test("cleanup failure is explicit, not reported as rolled back", async () => {
  assert.equal((await fixture({ provisionFails: true, cleanupFails: true }).invoke()).body.code, "PROVISIONING_REQUIRES_REVIEW");
});
test("unknown transaction outcome is never compensated destructively", async () => {
  const f = fixture({ transportFails: true });
  assert.equal((await f.invoke()).body.code, "PROVISIONING_REQUIRES_REVIEW");
  assert.ok(!f.calls.includes("delete-auth"));
});
test("a concurrent request cannot adopt an incomplete Auth account", async () => {
  const f = fixture({ target: true, incomplete: true });
  assert.equal((await f.invoke()).body.code, "PROVISIONING_IN_PROGRESS");
  assert.ok(!f.calls.includes("portal_provision_recruiter"));
  assert.ok(!f.calls.includes("delete-auth"));
});
test("email failure keeps a valid account and compatible retry creates no second account", async () => {
  const f = fixture({ emailFails: true });
  const response = await f.invoke();
  assert.equal(response.status, 200);
  assert.equal(response.body.invited, false);
  assert.match(response.body.warning, /retry/);
  assert.ok(!f.calls.includes("delete-auth"));
  const retry = fixture({ target: true });
  assert.equal((await retry.invoke()).body.invited, true);
  assert.ok(!retry.calls.includes("create-auth"));
});
test("password validation and expired link errors", () => {
  assert.match(validateSetupPassword("short", "short"), /8/);
  assert.match(validateSetupPassword("longpassword", "different"), /match/);
  assert.match(validateSetupPassword("a".repeat(73), "a".repeat(73)), /72/);
  assert.equal(validateSetupPassword("new-password", "new-password"), "");
  assert.match(getPasswordLinkError({ hash: "#error=access_denied", search: "" }), /expired/);
});
test("admin directory is paginated and warns about missing assignments", async () => {
  const f = createReadFixture({
    profiles: Array.from({ length: 1201 }, (_, index) => ({ id: `r${index}`, role: "recruiter" })),
    recruiter_companies: [{ profile_id: "r0", company_id: COMPANY }], companies: [{ id: COMPANY, company_name: "Company A" }],
  });
  const service = await loadSource("services/recruiterManagementService.js", f.mocks);
  const result = await service.fetchRecruiterManagementData();
  assert.equal(result.recruiters.length, 1201);
  assert.equal(result.recruiters[0].company_name, "Company A");
  assert.match(result.warning, /assignments/);
  assert.equal(f.calls.filter((call) => call.table === "profiles").length, 2);
});
test("frontend invitation service preserves Edge errors and rejects silent no-result", async () => {
  const service = await loadSource("services/recruiterManagementService.js", {
    [source("services/supabaseClient.js")]: { supabase: { functions: { invoke: async () => ({ error: { context: Response.json({ error: "Admin only" }) } }) } } },
  }, { Response });
  await assert.rejects(service.inviteRecruiter(input), /Admin only/);
  const empty = await loadSource("services/recruiterManagementService.js", {
    [source("services/supabaseClient.js")]: { supabase: { functions: { invoke: async () => ({ data: {} }) } } },
  }, { Response });
  await assert.rejects(empty.inviteRecruiter(input), /verified/);
});
test("password saved/sign-out failure retries logout without updating password twice", async () => {
  const h = hookHarness();
  let updates = 0;
  let signouts = 0;
  let destination;
  const module = await loadSource("hooks/usePasswordSetup.js", {
    react: h.react,
    "react-router-dom": { useNavigate: () => (path) => { destination = path; } },
    [source("hooks/useAuth.js")]: { useAuth: () => ({ user: { id: "recruiter", email: input.email }, isAuthReady: true,
      signOut: async () => { if (++signouts === 1) throw new Error("Sign out failed"); } }) },
    [source("services/authService.js")]: { setCurrentUserPassword: async () => { updates++; } },
  }, { window: { location: { hash: "", search: "" } }, URLSearchParams, TextEncoder });
  let state = h.render(module.usePasswordSetup);
  state.setPassword("new-password"); state.setConfirmation("new-password");
  state = h.render(module.usePasswordSetup);
  await state.submit();
  state = h.render(module.usePasswordSetup);
  assert.equal(state.saved, true);
  await state.submit();
  assert.equal(updates, 1);
  assert.equal(destination, "/login");
});

test("admin invitation form/table render without mutation controls or data access", async () => {
  const Form = (await loadSource("components/admin/recruiters/RecruiterInviteForm.jsx")).default;
  const Table = (await loadSource("components/admin/recruiters/RecruitersTable.jsx")).default;
  const html = renderToStaticMarkup(createElement(Form, { form: input,
    companies: [{ id: COMPANY, company_name: "Company A" }], onFieldChange() {}, onSubmit() {} }));
  for (const text of ["Full Name", "Email", "Company A", "Invite Recruiter"]) assert.ok(html.includes(text));
  assert.match(renderToStaticMarkup(createElement(Table, { recruiters: [] })), /No recruiters/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(Table, { recruiters: [{ id: "r", company_name: "A" }] })), /Delete|Reassign|<button/);
  for (const file of ["pages/admin/RecruiterManagement.jsx", "pages/auth/PasswordSetup.jsx",
    "components/admin/recruiters/RecruiterInviteForm.jsx", "components/admin/recruiters/RecruitersTable.jsx",
    "components/auth/PasswordSetupForm.jsx", "hooks/useRecruiterManagement.js", "hooks/usePasswordSetup.js"]) {
    assert.doesNotMatch(await readFile(source(file), "utf8"), /supabase|\.auth\.|\.storage\./, file);
  }
});

test("admin route guard denies student/recruiter/anonymous and invitation callback stays outside role guards", async () => {
  let auth = { isAuthReady: true, isAuthenticated: true, role: "admin" };
  const router = { Navigate() {}, Outlet() {}, useLocation: () => ({ pathname: "/admin/recruiters" }) };
  const Guard = (await loadSource("routes/ProtectedRoute.jsx", {
    "react-router-dom": router, [source("hooks/useAuth.js")]: { useAuth: () => auth },
  })).default;
  assert.equal(Guard({ allowedRoles: ["admin"] }).type, router.Outlet);
  for (const role of ["student", "recruiter"]) {
    auth = { ...auth, role };
    assert.equal(Guard({ allowedRoles: ["admin"] }).props.to, `/${role}/dashboard`);
  }
  auth = { ...auth, isAuthenticated: false };
  assert.equal(Guard({ allowedRoles: ["admin"] }).props.to, "/login");
  const text = await readFile(source("routes/AppRoutes.jsx"), "utf8");
  const mocks = {};
  for (const match of text.matchAll(/from "(\.\.\/(?:pages|layouts)\/[^\"]+)"/g)) {
    mocks[path.resolve(path.dirname(source("routes/AppRoutes.jsx")), `${match[1]}.jsx`)] = { default() {} };
  }
  const Routes = (await loadSource("routes/AppRoutes.jsx", mocks)).default;
  const branches = Routes().props.children.props.children;
  const admin = branches.find((route) => route.props.element?.props.allowedRoles?.includes("admin"));
  assert.ok(admin.props.children.props.children.some((route) => route.props.path === "recruiters"));
  assert.ok(branches.some((route) => route.props.path === "/auth/setup-password"));
});

test("password service refuses a changed session before issuing an update", async () => {
  let updated = false;
  const service = await loadSource("services/authService.js", {
    [source("services/supabaseClient.js")]: { supabase: { auth: {
      getSession: async () => ({ data: { session: { user: { id: "someone-else" } } } }),
      updateUser: async () => { updated = true; return {}; },
    } } },
  });
  await assert.rejects(service.setCurrentUserPassword("new-password", "invited-user"), /session changed/);
  assert.equal(updated, false);
});
