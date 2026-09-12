import { supabase } from "./supabaseClient";
import { fetchRowsByIds } from "./supabaseReads";
import { AUDIT_ACTION_LABELS, AUDIT_ACTOR_ROLES, AUDIT_PAGE_SIZE } from "../constants/auditLogs";

const COLUMNS = "id,actor_profile_id,actor_role,action,entity_type,entity_id,old_status,new_status,metadata,created_at";

export async function fetchAuditLogs({ action = "", role = "", page = 0 } = {}) {
  if ((action && !Object.hasOwn(AUDIT_ACTION_LABELS, action)) || (role && !AUDIT_ACTOR_ROLES.includes(role))
    || !Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger((page + 1) * AUDIT_PAGE_SIZE)) {
    throw new Error("Invalid audit log filter or page.");
  }
  let query = supabase.from("audit_logs").select(COLUMNS)
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (action) query = query.eq("action", action);
  if (role) query = query.eq("actor_role", role);
  const start = page * AUDIT_PAGE_SIZE;
  const { data, error } = await query.range(start, start + AUDIT_PAGE_SIZE);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Audit log results could not be verified.");
  const events = data.slice(0, AUDIT_PAGE_SIZE);
  const actorIds = [...new Set(events.map((event) => event.actor_profile_id))];
  // Names are current profile labels, not historical PII stored in the audit record.
  let profiles;
  try { profiles = await fetchRowsByIds("profiles", "id,full_name", actorIds); }
  catch (error) { profiles = { error }; }
  const names = new Map((profiles.data || []).map((profile) => [profile.id, profile.full_name]));
  const missingNames = actorIds.some((id) => !names.get(id));
  return {
    events: events.map((event) => ({ ...event, actor_name: names.get(event.actor_profile_id) || "" })),
    hasNext: data.length > AUDIT_PAGE_SIZE,
    warning: profiles.error ? "Actor names could not be loaded. Profile IDs are shown."
      : missingNames ? "Some actor profiles or names are unavailable. Historical profile IDs are shown." : "",
  };
}
