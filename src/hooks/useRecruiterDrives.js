import { useEffect, useState } from "react";
import { useRecruiterCompany } from "./useRecruiterCompany";
import { fetchCompanyDrives } from "../services/drivesService";

export function useRecruiterDrives() {
  const companyState = useRecruiterCompany();
  const { company } = companyState;
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!company) return;
    let active = true;
    fetchCompanyDrives(company.id).then(
      (drives) => {
        if (active) setResult({ company, drives, error: "" });
      },
      (error) => {
        if (active) setResult({
          company, drives: [],
          error: error?.message || "Unable to load company drives. Please try again.",
        });
      },
    );
    return () => { active = false; };
  }, [company]);

  const current = result?.company === company ? result : null;
  return {
    companyState,
    drives: current?.drives || [],
    error: current?.error || "",
    isLoading: companyState.isLoading || (Boolean(company) && !current),
    // Reload the assignment too, so an Admin reassignment cannot leave stale scope.
    refresh: companyState.refresh,
  };
}
