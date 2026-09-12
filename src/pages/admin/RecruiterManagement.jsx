import StatusMessage from "../../components/common/StatusMessage";
import RecruiterInviteForm from "../../components/admin/recruiters/RecruiterInviteForm";
import RecruitersTable from "../../components/admin/recruiters/RecruitersTable";
import { useRecruiterManagement } from "../../hooks/useRecruiterManagement";
import "../../styles/accountProvisioning.css";

export default function RecruiterManagement() {
  const directory = useRecruiterManagement();
  return (
    <section className="recruiter-management">
      <header><h1>Recruiter Management</h1>
        <button type="button" onClick={directory.refresh} disabled={directory.isLoading || directory.isSaving}>Reload</button>
      </header>
      <StatusMessage type="error">{directory.loadError || directory.feedback.error}</StatusMessage>
      <StatusMessage type="success">{directory.feedback.success}</StatusMessage>
      <StatusMessage type="warning">{directory.warning || directory.feedback.warning}</StatusMessage>
      {!directory.isLoading && !directory.loadError && !directory.companies.length
        && <StatusMessage type="warning">Add a company before inviting a recruiter.</StatusMessage>}
      <RecruiterInviteForm form={directory.form} companies={directory.companies}
        disabled={directory.isLoading || !directory.companies.length} isSaving={directory.isSaving}
        onFieldChange={directory.setField} onSubmit={directory.submit} />
      {directory.isLoading ? <p role="status">Loading recruiters...</p> : !directory.loadError && <>
        <h2>Provisioned Recruiters ({directory.recruiters.length})</h2>
        <RecruitersTable recruiters={directory.recruiters} />
      </>}
    </section>
  );
}
