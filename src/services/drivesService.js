import { supabase } from "./supabaseClient";
import { fetchRowsByIds } from "./supabaseReads";
import { fetchCompanyNamesByIds } from "./companiesService";
import { mapDrivesWithCompanies } from "../utils/studentApplications";

export async function fetchStudentDrives(driveIds) {
  let drives;
  if (driveIds) {
    const { data, error } = await fetchRowsByIds(
      "placement_drives", DRIVE_COLUMNS, [...new Set(driveIds.filter(Boolean))]
    );
    if (error) throw error;
    drives = data;
  } else {
    drives = await fetchDriveRows();
  }
  const companies = await fetchCompanyNamesByIds(drives.map((drive) => drive.company_id));
  return mapDrivesWithCompanies(drives, companies);
}

const DRIVE_COLUMNS =
  "id, company_id, role, min_cgpa, allowed_branches, package, deadline, created_at";

async function fetchDriveRows(companyId) {
  const drives = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    let query = supabase.from("placement_drives").select(DRIVE_COLUMNS);
    if (companyId) query = query.eq("company_id", companyId);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) throw error;
    drives.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return drives;
}

export async function fetchCompanyDrives(companyId) {
  // A missing assignment must never fall back to the unscoped Student reader.
  if (!companyId) return [];
  return fetchDriveRows(companyId);
}

function createNoResultError(resultAction, policyAction) {
  const error = new Error(
    `The placement drive was not ${resultAction}. Check the admin ${policyAction} policy in Supabase.`,
  );
  error.code = "RLS_NO_RESULT";
  return error;
}

async function fetchPlacementDrives() {
  const { data, error } = await supabase
    .from("placement_drives")
    .select(DRIVE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

async function fetchCompanyOptions() {
  const { data, error } = await supabase
    .from("companies")
    .select("id, company_name")
    .order("company_name", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function fetchDriveManagementData() {
  const [driveRows, companies] = await Promise.all([
    fetchPlacementDrives(),
    fetchCompanyOptions(),
  ]);
  const companyNameById = new Map(
    companies.map((company) => [company.id, company.company_name]),
  );
  const drives = driveRows.map((drive) => ({
    ...drive,
    company_name: companyNameById.get(drive.company_id) || "Unknown company",
    hasKnownCompany: companyNameById.has(drive.company_id),
  }));

  return { drives, companies };
}

export async function createDrive(drivePayload) {
  const { data, error } = await supabase
    .from("placement_drives")
    .insert(drivePayload)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createNoResultError("created", "insert and select");
  }

  return data;
}

export async function updateDrive(driveId, drivePayload) {
  const { data, error } = await supabase
    .from("placement_drives")
    .update(drivePayload)
    .eq("id", driveId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createNoResultError("updated", "update and select");
  }

  return data;
}

export async function deleteDrive(driveId) {
  const { data, error } = await supabase
    .from("placement_drives")
    .delete()
    .eq("id", driveId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createNoResultError("deleted", "delete and select");
  }

  return data;
}
