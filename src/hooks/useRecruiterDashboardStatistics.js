import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useRecruiterCompany } from "./useRecruiterCompany";
import { fetchRecruiterDashboardStatistics } from "../services/recruiterDashboardService";
import { RECRUITER_DASHBOARD_METRICS } from "../constants/recruiterDashboardMetrics";

export function useRecruiterDashboardStatistics() {
  const { user } = useAuth();
  const profileId = user?.id;
  const companyState = useRecruiterCompany();
  const { company } = companyState;
  const [result, setResult] = useState(null);
  const refreshPending = useRef(false);

  useEffect(() => {
    if (!company || !profileId) {
      refreshPending.current = false;
      return;
    }
    let active = true;
    async function load() {
      let next;
      try {
        next = await fetchRecruiterDashboardStatistics(company.id);
      } catch (error) {
        next = { counts: {}, errors: Object.fromEntries(RECRUITER_DASHBOARD_METRICS.map(({ key }) =>
          [key, error?.message || "Unable to load dashboard statistics."])) };
      }
      if (!active) return;
      setResult((previous) => ({
        profileId, companyId: company.id, requestCompany: company,
        counts: { ...(previous?.profileId === profileId && previous.companyId === company.id ? previous.counts : {}), ...next.counts },
        errors: next.errors,
      }));
      refreshPending.current = false;
    }
    load();
    return () => { active = false; };
  }, [company, profileId]);

  // Never show another account/company's cached statistics, including the render
  // before an effect cleans up. Refresh re-resolves membership before any reuse.
  const current = company && result?.profileId === profileId && result.companyId === company.id ? result : null;
  const isLoading = companyState.isLoading || Boolean(company && current?.requestCompany !== company);
  const stats = current?.counts || {};
  const errors = current?.requestCompany === company ? current?.errors || {} : {};
  const displayStats = Object.fromEntries(RECRUITER_DASHBOARD_METRICS.map(({ key }) => {
    const count = stats[key];
    return [key, count === undefined ? (isLoading ? "Loading..." : "Unavailable")
      : isLoading ? `${count} (refreshing)` : errors[key] ? `${count} (stale)` : count];
  }));
  const errorMessage = RECRUITER_DASHBOARD_METRICS.filter(({ key }) => errors[key])
    .map(({ key, title }) => `${title}: ${errors[key]}`).join(" ");

  function refresh() {
    if (isLoading || refreshPending.current) return;
    refreshPending.current = true;
    companyState.refresh();
  }

  return { companyState, stats, displayStats, errors, errorMessage, isLoading, refresh };
}
