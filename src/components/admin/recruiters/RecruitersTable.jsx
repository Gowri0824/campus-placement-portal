import { formatDate } from "../../../utils/dates";

export default function RecruitersTable({ recruiters }) {
  if (!recruiters.length) return <p>No recruiters have been provisioned.</p>;
  return (
    <div className="provisioning-table-wrap">
      <table>
        <thead><tr><th>Full Name</th><th>Email</th><th>Company</th><th>Created</th></tr></thead>
        <tbody>
          {recruiters.map((recruiter) => (
            <tr key={recruiter.id}>
              <td>{recruiter.full_name || "Not available"}</td>
              <td>{recruiter.email || "Not available"}</td>
              <td>{recruiter.company_name}</td>
              <td>{formatDate(recruiter.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
