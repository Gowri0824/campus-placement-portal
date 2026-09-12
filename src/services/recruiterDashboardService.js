import { supabase } from "./supabaseClient";
import { RECRUITER_DASHBOARD_METRICS } from "../constants/recruiterDashboardMetrics";

async function fetchCompanyCount(companyId, { key, status }) {
  // The inner relationship filters application rows, not just embedded drives.
  // RLS independently authorizes both tables. HEAD returns no applicant records.
  let query = key === "drives"
    ? supabase.from("placement_drives").select("id", { count: "exact", head: true }).eq("company_id", companyId)
    : supabase.from("applications").select("id, placement_drives!inner(id)", { count: "exact", head: true })
      .eq("placement_drives.company_id", companyId);
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  if (error) throw error;
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("The database did not return a valid count.");
  }
  return count;
}

export async function fetchRecruiterDashboardStatistics(companyId) {
  if (!companyId) throw new Error("A company assignment is required to load dashboard statistics.");
  const results = await Promise.allSettled(RECRUITER_DASHBOARD_METRICS.map((metric) => fetchCompanyCount(companyId, metric)));
  const counts = {};
  const errors = {};
  results.forEach((result, index) => {
    const { key } = RECRUITER_DASHBOARD_METRICS[index];
    if (result.status === "fulfilled") counts[key] = result.value;
    else errors[key] = result.reason?.message || "Unable to load this statistic.";
  });
  return { counts, errors };
}
