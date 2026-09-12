import { validateRecruiterInvitation } from "../../../shared/recruiterInvitation.js";
import { InviteError, provisionRecruiter } from "./provisioning.js";

export function createInviteHandler({ client, siteUrl }) {
  return async function handle(request) {
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS" };
    const reply = (body, status) => new Response(JSON.stringify(body), { status, headers });
    let redirect;
    try {
      redirect = new URL("/auth/setup-password", siteUrl);
      if (redirect.protocol !== "https:" && !(redirect.protocol === "http:"
        && ["localhost", "127.0.0.1"].includes(redirect.hostname))) throw new Error();
    } catch {
      return reply({ error: "Invitation service needs a valid PORTAL_SITE_URL configuration." }, 503);
    }
    const origin = request.headers.get("Origin");
    if (origin && origin !== redirect.origin) return reply({ error: "Origin not permitted." }, 403);
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
    const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get("Authorization") || "")?.[1];
    if (!token) return reply({ error: "Authentication required." }, 401);
    try {
      // Validate the JWT with Supabase Auth, then resolve the role from the database.
      const { data, error } = await client.auth.getUser(token);
      if (error || !data?.user || data.user.is_anonymous) return reply({ error: "Authentication required." }, 401);
      const profile = await client.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (profile.error) return reply({ error: "Administrator authorization could not be verified." }, 503);
      if (profile.data?.role !== "admin") return reply({ error: "Administrator access required." }, 403);
      const body = await request.text();
      if (body.length > 4096) return reply({ error: "Request is too large." }, 413);
      let input;
      try { input = JSON.parse(body); } catch { return reply({ error: "Invalid JSON request." }, 400); }
      const validation = validateRecruiterInvitation(input);
      if (validation.error) return reply({ error: validation.error }, 400);
      const result = await provisionRecruiter(client, data.user.id, validation.value, redirect.href, crypto.randomUUID());
      return reply(result, 200);
    } catch (error) {
      return reply({ error: error instanceof InviteError ? error.message : "Invitation service unavailable. Retry the same email/company.",
        code: error instanceof InviteError ? error.code : "SERVICE_UNAVAILABLE" }, error instanceof InviteError ? error.status : 503);
    }
  };
}
