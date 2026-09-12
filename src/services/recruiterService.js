import { supabase } from "./supabaseClient";
import { fetchCompanyById } from "./companiesService";

export async function fetchRecruiterCompany(profileId) {
  if (!profileId) throw new Error("Please log in to view your company.");
  const { data: membership, error } = await supabase
    .from("recruiter_companies")
    .select("profile_id, company_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!membership) return null;

  // Separate reads reuse the company service; RLS scopes both requests.
  const company = await fetchCompanyById(membership.company_id);
  if (!company) {
    throw new Error("Your assigned company is unavailable. Please contact your placement administrator.");
  }
  return company;
}
