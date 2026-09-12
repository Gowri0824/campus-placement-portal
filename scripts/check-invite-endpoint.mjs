// Read-only authorization probes: never send valid credentials or recruiter data.
import assert from "node:assert/strict";
const endpoint = new URL(process.argv[2]);
if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".supabase.co")
  || endpoint.pathname !== "/functions/v1/invite-recruiter") throw new Error("Expected Supabase invite-recruiter endpoint.");
const origin = process.argv[3] || "http://127.0.0.1:5173";
for (const [name, method, headers, status] of [
  ["anonymous", "POST", { Origin: origin }, 401],
  ["forged token", "POST", { Origin: origin, Authorization: "Bearer invalid-test-token" }, 401],
  ["untrusted origin", "POST", { Origin: "https://untrusted.example" }, 403],
  ["CORS preflight", "OPTIONS", { Origin: origin }, 204],
]) {
  const response = await fetch(endpoint, { method, headers, ...(method === "POST" ? { body: "{}" } : {}), signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, status, `${name}: ${await response.text()}`);
  if (name === "CORS preflight") assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  console.log(`${name}: passed (${status})`);
}
