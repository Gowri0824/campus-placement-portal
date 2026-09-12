import { APPLICATION_STATUS_OPTIONS } from "../../constants/applicationStatuses";

export default function RecruiterApplicantFilters({ drives, companyName, filters, onChange, onClear }) {
  return (
    <div className="recruiter-applicant-filters">
      <label>Placement Drive
        <select value={filters.driveId} onChange={(event) => onChange({ ...filters, driveId: event.target.value })}>
          <option value="">All drives</option>
          {drives.map((drive) => <option key={drive.id} value={drive.id}>{companyName} - {drive.role || "Role not available"}</option>)}
        </select>
      </label>
      <label>Application Status
        <select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
          <option value="">All statuses</option>
          {APPLICATION_STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      </label>
      <button type="button" onClick={onClear} disabled={!filters.driveId && !filters.status}>Clear Filters</button>
    </div>
  );
}
