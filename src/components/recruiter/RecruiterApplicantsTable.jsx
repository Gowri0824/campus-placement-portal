import { Fragment } from "react";
import { formatDate } from "../../utils/dates";
import { getApplicationStatusCategory } from "../../utils/applicationStatus";
import { APPLICATION_STATUS_VALUES } from "../../constants/applicationStatuses";
import RecruiterApplicantDetails from "./RecruiterApplicantDetails";
import RecruiterApplicantDecision from "./RecruiterApplicantDecision";

export default function RecruiterApplicantsTable({ applications, total, expandedId, onToggleDetails, resume, onDecision, updatingId }) {
  if (!applications.length) return <p className="recruiter-empty">{total
    ? "No applications match the selected filters." : "No applications for your company drives yet."}</p>;
  return (
    <div className="recruiter-table-wrap" tabIndex={0} aria-label="Recruiter applicants">
      <table className="recruiter-table recruiter-applicants-table">
        <thead><tr>{["Student", "Academics", "Company / Role", "Applied", "Status", "Details"].map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
        <tbody>{applications.map((application) => <Fragment key={application.id}>
          <tr>
            <td><strong>{application.student_name}</strong><div>{application.email || "Email not available"}</div><div className="recruiter-muted">{application.student?.roll_number || "Roll number not available"}</div></td>
            <td>{application.student?.branch || "Branch not available"}<div>CGPA: {application.student?.cgpa ?? "Not available"}</div><div>Graduation: {application.student?.graduation_year ?? "Not available"}</div></td>
            <td>{application.company_name}<div>{application.role}</div></td>
            <td>{formatDate(application.applied_at)}</td>
            <td><span className={`recruiter-status recruiter-status-${APPLICATION_STATUS_VALUES.includes(application.status) ? getApplicationStatusCategory(application.status) : "unknown"}`}>{application.status || "Not available"}</span>
              <RecruiterApplicantDecision application={application} onDecision={onDecision} updatingId={updatingId} /></td>
            <td><button type="button" aria-expanded={expandedId === application.id}
              aria-label={`${expandedId === application.id ? "Hide" : "View"} details for ${application.student_name}`}
              onClick={() => onToggleDetails(application.id)}>{expandedId === application.id ? "Hide Details" : "View Details"}</button></td>
          </tr>
          {expandedId === application.id && <tr><td colSpan={6}><RecruiterApplicantDetails application={application} resume={resume} /></td></tr>}
        </Fragment>)}</tbody>
      </table>
    </div>
  );
}
