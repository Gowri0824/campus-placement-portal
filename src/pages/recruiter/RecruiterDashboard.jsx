import { useOutletContext } from "react-router-dom";
import RecruiterAccountSummary from "../../components/recruiter/RecruiterAccountSummary";
import RecruiterDashboardStatistics from "../../components/recruiter/RecruiterDashboardStatistics";
import { useRecruiterDashboardStatistics } from "../../hooks/useRecruiterDashboardStatistics";

export default function RecruiterDashboard() {
  const { fullName, email } = useOutletContext();
  const statistics = useRecruiterDashboardStatistics();
  return (
    <>
      <header className="recruiter-page-header">
        <h1>Recruiter Dashboard</h1>
        <button type="button" onClick={statistics.refresh} disabled={statistics.isLoading}>Reload</button>
      </header>
      <RecruiterAccountSummary fullName={fullName} email={email} companyState={statistics.companyState} />
      {statistics.companyState.company && <RecruiterDashboardStatistics {...statistics} onRetry={statistics.refresh} />}
    </>
  );
}
