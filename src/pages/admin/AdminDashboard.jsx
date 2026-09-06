import DashboardCard from "../../components/admin/DashboardCard";
import Statistics from "../../components/admin/Statistics";
import StatusMessage from "../../components/common/StatusMessage";
import { DASHBOARD_TOTAL_METRICS } from "../../constants/dashboardMetrics";
import { useDashboardStatistics } from "../../hooks/useDashboardStatistics";

export default function AdminDashboard() {
  const { displayStats, errorMessage, isLoading, refresh } = useDashboardStatistics();

  return (
    <>
      {isLoading && <StatusMessage>Loading dashboard statistics...</StatusMessage>}
      <StatusMessage type="error">
        {errorMessage && (
          <>
            {errorMessage} Previously loaded values are marked stale.
            {" "}<button type="button" onClick={refresh} disabled={isLoading}>Retry</button>
          </>
        )}
      </StatusMessage>
      <div className="dashboard-cards" aria-busy={isLoading}>
        {DASHBOARD_TOTAL_METRICS.map(({ key, title }) => (
          <DashboardCard key={key} title={title} value={displayStats[key]} />
        ))}
      </div>
      <Statistics stats={displayStats} />
    </>
  );
}
