import { useEffect, useRef, useState } from "react";
import { fetchDashboardStatistics } from "../services/dashboardService";
import { DASHBOARD_TOTAL_METRICS, DASHBOARD_STATUS_METRICS } from "../constants/dashboardMetrics";

const metrics = [...DASHBOARD_TOTAL_METRICS, ...DASHBOARD_STATUS_METRICS];

export function useDashboardStatistics() {
  const [stats, setStats] = useState({});
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const refreshPending = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      try {
        const result = await fetchDashboardStatistics();
        if (!active) return;
        setStats((previous) => ({ ...previous, ...result.counts }));
        setErrors(result.errors);
      } catch (error) {
        if (active) {
          setErrors(Object.fromEntries(metrics.map(({ key }) => [
            key, error?.message || "Unable to load dashboard statistics.",
          ])));
        }
      } finally {
        if (active) {
          setIsLoading(false);
          refreshPending.current = false;
        }
      }
    }
    load();
    return () => { active = false; };
  }, [refreshVersion]);

  function refresh() {
    if (isLoading || refreshPending.current) return;
    refreshPending.current = true;
    setRefreshVersion((value) => value + 1);
  }

  const displayStats = Object.fromEntries(metrics.map(({ key }) => {
    const value = stats[key];
    return [key, value === undefined
      ? (isLoading ? "Loading..." : "Unavailable")
      : errors[key] ? `${value} (stale)` : value];
  }));
  const errorMessage = metrics.filter(({ key }) => errors[key])
    .map(({ key, title }) => `${title}: ${errors[key]}`).join(" ");

  return { stats, displayStats, errors, errorMessage, isLoading, refresh };
}
