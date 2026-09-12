import { supabase } from "./supabaseClient";
import { fetchPaginatedRows, fetchRowsByIds } from "./supabaseReads";

export function fetchCompanyOptions() {
  return fetchPaginatedRows(() => supabase.from("companies")
    .select("id, company_name").order("company_name").order("id"));
}

export async function fetchCompanyNamesByIds(ids) {
  const { data, error } = await fetchRowsByIds(
    "companies", "id, company_name", [...new Set(ids.filter(Boolean))]
  );
  if (error) throw error;
  return data;
}

const COMPANY_COLUMNS =
  "id, company_name, website, description, location, created_at";

export async function fetchCompanyById(companyId) {
  if (!companyId) return null;
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function toCompanyPayload(company) {
  return {
    company_name: company.companyName.trim(),
    website: company.website.trim() || null,
    location: company.location.trim() || null,
    description: company.description.trim() || null,
  };
}

function createNoResultError(resultAction, policyAction) {
  const error = new Error(
    `The company was not ${resultAction}. Check the admin ${policyAction} policy in Supabase.`,
  );
  error.code = "RLS_NO_RESULT";
  return error;
}

export async function fetchCompanies() {
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function createCompany(company) {
  const { data, error } = await supabase
    .from("companies")
    .insert(toCompanyPayload(company))
    .select(COMPANY_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createNoResultError("created", "insert and select");
  }

  return data;
}

export async function updateCompany(companyId, company) {
  const { data, error } = await supabase
    .from("companies")
    .update(toCompanyPayload(company))
    .eq("id", companyId)
    .select(COMPANY_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createNoResultError("updated", "update and select");
  }

  return data;
}

export async function deleteCompany(companyId) {
  const { data, error } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId)
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
