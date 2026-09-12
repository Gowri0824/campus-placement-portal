import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inspectFile } from "../scripts/check-repository-secrets.mjs";

const scanner = fileURLToPath(new URL("../scripts/check-repository-secrets.mjs", import.meta.url));
const frontendScanner = fileURLToPath(new URL("../scripts/check-frontend-secrets.mjs", import.meta.url));
const fakeSecret = ["sb", "secret", "fixture".repeat(6)].join("_");
const jwt = (role) => [
  Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url"),
  Buffer.from(JSON.stringify({ role })).toString("base64url"),
  "fixtureSignature",
].join(".");

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "portal-secret-scan-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("portal-secret-scan-"));
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test("repository scan recognizes credential formats without treating public configuration as secret", () => {
  for (const value of [fakeSecret, ["sbp", "x".repeat(30)].join("_"),
    ["ghp", "x".repeat(30)].join("_"), ["github", "pat", "x".repeat(30)].join("_"),
    ["-----BEGIN ", "PRIVATE KEY-----"].join(""), ["postgresql://user", "fixture@db.invalid/db"].join(":"),
    jwt("service_role")]) assert.ok(inspectFile("example.txt", value).length);
  assert.deepEqual(inspectFile("supabase/functions/example.ts", 'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")'), []);
  assert.deepEqual(inspectFile(".env.example", "VITE_SUPABASE_ANON_KEY=" + jwt("anon")), []);
});

test("repository scan rejects sensitive/local artifact paths", () => {
  for (const name of [".env", "nested/.env.local", "supabase/.temp/project-ref", "supabase/.branches/main",
    "dist/index.html", "node_modules/example.js", "debug.log", "private.pem"]) {
    assert.ok(inspectFile(name, "").length, name);
  }
  assert.deepEqual(inspectFile("supabase/migrations/20260101000000_durable.sql", "select 1;"), []);
});

test("repository CLI skips ignored local files but fails for tracked ones without printing secrets", async (t) => {
  const cwd = await fixture(t);
  execFileSync("git", ["init", "--quiet"], { cwd });
  await writeFile(path.join(cwd, ".gitignore"), ".env\n");
  await writeFile(path.join(cwd, ".env"), fakeSecret);
  assert.equal(spawnSync(process.execPath, [scanner], { cwd }).status, 0);
  execFileSync("git", ["add", "--force", "--", ".env"], { cwd });
  const result = spawnSync(process.execPath, [scanner], { cwd, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\.env/);
  assert.ok(!result.stderr.includes(fakeSecret));
});

test("repository CLI fails closed when it cannot inspect Git", async (t) => {
  const cwd = await fixture(t);
  const result = spawnSync(process.execPath, [scanner], { cwd, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /could not complete/);
});

test("frontend scan accepts public keys and rejects privileged credentials in the bundle", async (t) => {
  const cwd = await fixture(t);
  for (const name of ["src", "shared", "dist"]) await mkdir(path.join(cwd, name));
  const bundle = path.join(cwd, "dist", "app.js");
  await writeFile(bundle, jwt("anon"));
  assert.equal(spawnSync(process.execPath, [frontendScanner], { cwd }).status, 0);
  for (const content of [fakeSecret, jwt("service_role"), ["VITE", "SERVER", "SECRET"].join("_")]) {
    await writeFile(bundle, content);
    assert.equal(spawnSync(process.execPath, [frontendScanner], { cwd }).status, 1);
  }
});

test("frontend scan fails when a build has not been produced", async (t) => {
  const cwd = await fixture(t);
  for (const name of ["src", "shared"]) await mkdir(path.join(cwd, name));
  assert.equal(spawnSync(process.execPath, [frontendScanner], { cwd }).status, 1);
});
