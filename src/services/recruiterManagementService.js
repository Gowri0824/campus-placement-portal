import { supabase } from "./supabaseClient";
import { fetchCompanyOptions } from "./companiesService";
import { fetchPaginatedRows } from "./supabaseReads";
import { ROLES } from "../constants/roles";
import { mapRecruiterDirectory } from "../utils/recruiterManagement";

export async function fetchRecruiterManagementData() {
  const [profiles, assignments, companies] = await Promise.all([
    fetchPaginatedRows(() => supabase.from("profiles")
      .select("id, full_name, email, created_at").eq("role", ROLES.RECRUITER).order("id")),
    fetchPaginatedRows(() => supabase.from("recruiter_companies")
      .select("profile_id, company_id").order("profile_id")),
    fetchCompanyOptions(),
  ]);
  return { companies, ...mapRecruiterDirectory(profiles, assignments, companies) };
}

export async function inviteRecruiter(input) {
  const { data, error } = await supabase.functions.invoke("invite-recruiter", { body: input });
  if (error) {
    let message = "Invitation could not be confirmed. Check the Edge Function deployment and retry the same email/company.";
    if (error.context instanceof Response) {
      try {
        const body = await error.context.json();
        if (typeof body.error === "string") message = body.error;
      } catch { /* Network/gateway failures may not have a JSON body. */ }
    }
    throw new Error(message);
  }
  if (!data?.userId || typeof data.invited !== "boolean" || data.error) {
    throw new Error(data?.error || "Invitation result could not be verified. Refresh before retrying.");
  }
  return data;
}
