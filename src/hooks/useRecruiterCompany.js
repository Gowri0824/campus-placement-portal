import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { fetchRecruiterCompany } from "../services/recruiterService";

export function useRecruiterCompany() {
  const { user } = useAuth();
  const profileId = user?.id;
  const [requestVersion, setRequestVersion] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    fetchRecruiterCompany(profileId).then(
      (company) => {
        if (active) setResult({ profileId, requestVersion, company, error: "" });
      },
      (error) => {
        if (active) setResult({
          profileId, requestVersion, company: null,
          error: error?.message || "Unable to load company information. Please try again.",
        });
      },
    );
    return () => { active = false; };
  }, [profileId, requestVersion]);

  // Hide stale identity/assignment data immediately, even before effects run.
  const current = result?.profileId === profileId && result?.requestVersion === requestVersion
    ? result : null;
  return {
    company: current?.company || null,
    isLoading: Boolean(profileId) && !current,
    error: profileId ? current?.error || "" : "Please log in to view your company.",
    warning: current && !current.company && !current.error
      ? "No company assignment is available for this account. Please contact your placement administrator."
      : "",
    refresh: () => setRequestVersion((version) => version + 1),
  };
}
