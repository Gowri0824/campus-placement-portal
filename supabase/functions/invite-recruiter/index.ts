import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { createInviteHandler } from "./handler.js";

// This privileged client is server-only and never inherits the caller's JWT.
const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
Deno.serve(createInviteHandler({ client, siteUrl: Deno.env.get("PORTAL_SITE_URL") }));
