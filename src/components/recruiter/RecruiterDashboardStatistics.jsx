import DashboardCard from "../admin/DashboardCard";
import StatusMessage from "../common/StatusMessage";
import { RECRUITER_DASHBOARD_METRICS } from "../../constants/recruiterDashboardMetrics";

export default function RecruiterDashboardStatistics({ displayStats, isLoading, errorMessage, onRetry }) {
  return (
    <section className="recruiter-dashboard-statistics" aria-label="Company statistics">
      {isLoading && <p role="status">Loading company statistics...</p>}
      <StatusMessage type="error">{errorMessage && <>
        {errorMessage} <button type="button" onClick={onRetry} disabled={isLoading}>Retry</button>
      </>}</StatusMessage>
      <div className="recruiter-metrics" aria-busy={isLoading}>
        {RECRUITER_DASHBOARD_METRICS.map(({ key, title }) =>
          <DashboardCard key={key} title={title} value={displayStats[key]} />)}
      </div>
    </section>
  );
}
