import { supabase } from "./supabaseClient";
import { APPLICATION_STATUS } from "../constants/applicationStatuses";

const queries = [
  { key: "students", table: "students" },
  { key: "companies", table: "companies" },
  { key: "drives", table: "placement_drives" },
  { key: "applications", table: "applications" },
  { key: "pending", table: "applications", status: APPLICATION_STATUS.APPLIED },
  { key: "selected", table: "applications", status: APPLICATION_STATUS.SELECTED },
  { key: "rejected", table: "applications", status: APPLICATION_STATUS.REJECTED },
  { key: "withdrawn", table: "applications", status: APPLICATION_STATUS.WITHDRAWN },
];

async function fetchCount({ table, status }) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  if (error) throw error;
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("The database did not return a valid count.");
  }
  return count;
}

export async function fetchDashboardStatistics() {
  // Keep independent metrics usable even when one count request fails.
  const results = await Promise.allSettled(queries.map(fetchCount));
  const counts = {};
  const errors = {};
  results.forEach((result, index) => {
    const key = queries[index].key;
    if (result.status === "fulfilled") counts[key] = result.value;
    else errors[key] = result.reason?.message || "Unable to load this statistic.";
  });
  return { counts, errors };
}
