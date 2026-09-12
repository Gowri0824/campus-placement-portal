import { APPLICATION_STATUS } from "../../constants/applicationStatuses";

export default function RecruiterApplicantDecision({ application, onDecision, updatingId }) {
  if (application.status !== APPLICATION_STATUS.APPLIED) return null;
  const saving = updatingId === application.id;
  return <div className="recruiter-decision-actions" aria-busy={saving}>
    <button type="button" disabled={Boolean(updatingId)} aria-label={`Select ${application.student_name}`}
      onClick={() => onDecision(application, APPLICATION_STATUS.SELECTED)}>Select</button>
    <button type="button" disabled={Boolean(updatingId)} aria-label={`Reject ${application.student_name}`}
      onClick={() => onDecision(application, APPLICATION_STATUS.REJECTED)}>Reject</button>
    {saving && <span role="status">Saving...</span>}
  </div>;
}
