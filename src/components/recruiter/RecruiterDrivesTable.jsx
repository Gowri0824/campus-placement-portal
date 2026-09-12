import { formatAllowedBranches } from "../../utils/branches";
import { formatDeadline } from "../../utils/dates";

export default function RecruiterDrivesTable({ drives }) {
  if (!drives.length) {
    return <p role="status" className="recruiter-empty">No placement drives are available for your company.</p>;
  }
  return (
    <>
      <p className="recruiter-muted">Total placement drives: {drives.length}</p>
      <div className="recruiter-table-wrap" role="region" aria-label="Company placement drives" tabIndex={0}>
        <table className="recruiter-table">
          <thead><tr>
            <th scope="col">Role</th><th scope="col">Package</th>
            <th scope="col">Minimum CGPA</th><th scope="col">Allowed Branches</th>
            <th scope="col">Deadline</th>
          </tr></thead>
          <tbody>{drives.map((drive) => (
            <tr key={drive.id}>
              <td><strong>{drive.role || "Not specified"}</strong></td>
              <td>{drive.package || "Not specified"}</td>
              <td>{drive.min_cgpa ?? "Not specified"}</td>
              <td>{formatAllowedBranches(drive.allowed_branches)}</td>
              <td>{formatDeadline(drive.deadline)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
