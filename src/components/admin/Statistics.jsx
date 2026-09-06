import { DASHBOARD_TOTAL_METRICS, DASHBOARD_STATUS_METRICS } from "../../constants/dashboardMetrics";

function MetricGrid({ metrics, stats }) {
  return (
    <div className="statistics-grid">
      {metrics.map(({ key, title, statisticsTitle }) => (
        <div className="stat-box" key={key}>
          <h3>{statisticsTitle || title}</h3>
          <p>{stats[key]}</p>
        </div>
      ))}
    </div>
  );
}

export default function Statistics({ stats }) {
  return (
    <div className="statistics">
      <h2>Placement Statistics</h2>
      <MetricGrid metrics={DASHBOARD_TOTAL_METRICS} stats={stats} />
      <h2>Application Status</h2>
      <MetricGrid metrics={DASHBOARD_STATUS_METRICS} stats={stats} />
    </div>
  );
}
