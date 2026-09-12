import { useRecruiterApplicants } from "../../hooks/useRecruiterApplicants";
import StatusMessage from "../../components/common/StatusMessage";
import RecruiterCompanyFeedback from "../../components/recruiter/RecruiterCompanyFeedback";
import RecruiterApplicantFilters from "../../components/recruiter/RecruiterApplicantFilters";
import RecruiterApplicantsTable from "../../components/recruiter/RecruiterApplicantsTable";

export default function RecruiterApplicants() {
  const directory = useRecruiterApplicants();
  return (
    <section className="recruiter-page">
      <header className="recruiter-page-header"><h1>Applicants for My Drives</h1>
        <button type="button" onClick={directory.refresh} disabled={directory.isLoading || Boolean(directory.updatingId)}>Reload</button></header>
      <RecruiterCompanyFeedback {...directory.companyState} />
      <StatusMessage type="error">{directory.error || directory.resume.error}</StatusMessage>
      <StatusMessage type="error">{directory.decisionError}</StatusMessage>
      <StatusMessage type="success">{directory.success}</StatusMessage>
      <StatusMessage type="warning">{directory.resume.warning}</StatusMessage>
      {directory.companyState.company && <>
        <h2>{directory.companyState.company.company_name}</h2>
        {directory.isLoading ? <p role="status">Loading applicants...</p> : !directory.error && <>
          {directory.warnings.map((warning) => <StatusMessage key={warning} type="warning">{warning}</StatusMessage>)}
          <RecruiterApplicantFilters drives={directory.drives} companyName={directory.companyState.company.company_name}
            filters={directory.filters} onChange={directory.changeFilters} onClear={directory.clearFilters} />
          <p role="status">{directory.matching} matching application(s) of {directory.total}</p>
          <RecruiterApplicantsTable applications={directory.applications} total={directory.total}
            expandedId={directory.expandedId} onToggleDetails={directory.toggleDetails} resume={directory.resume}
            onDecision={directory.decideApplication} updatingId={directory.updatingId} />
          {directory.matching > 0 && <nav className="recruiter-pagination" aria-label="Applicant pages">
            <button type="button" disabled={directory.page === 1} onClick={() => directory.changePage(directory.page - 1)}>Previous</button>
            <span>Page {directory.page} of {directory.pageCount}</span>
            <button type="button" disabled={directory.page === directory.pageCount} onClick={() => directory.changePage(directory.page + 1)}>Next</button>
          </nav>}
        </>}
      </>}
    </section>
  );
}
