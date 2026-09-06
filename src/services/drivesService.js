import { supabase } from "./supabaseClient";

const DRIVE_COLUMNS =
  "id, company_id, role, min_cgpa, allowed_branches, package, deadline, created_at";

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
