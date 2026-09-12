import { useRecruiterDrives } from "../../hooks/useRecruiterDrives";
import RecruiterCompanyFeedback from "../../components/recruiter/RecruiterCompanyFeedback";
import RecruiterDrivesTable from "../../components/recruiter/RecruiterDrivesTable";
import StatusMessage from "../../components/common/StatusMessage";

export default function CompanyDrives() {
  const { companyState, drives, isLoading, error, refresh } = useRecruiterDrives();
  return (
    <section className="recruiter-page">
      <header className="recruiter-page-header">
        <h1>Company Drives</h1>
        <button type="button" onClick={refresh} disabled={isLoading}>Reload</button>
      </header>
      <RecruiterCompanyFeedback {...companyState} />
      {companyState.company && (
        <>
          <h2>{companyState.company.company_name}</h2>
          <StatusMessage type="error">{error}</StatusMessage>
          {isLoading ? <p role="status">Loading company drives...</p>
            : !error && <RecruiterDrivesTable drives={drives} />}
        </>
      )}
    </section>
  );
}
