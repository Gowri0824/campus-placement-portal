import { AUDIT_ACTION_LABELS, AUDIT_ACTOR_ROLES } from "../../../constants/auditLogs";

export default function AuditLogFilters({ filters, onFilter }) {
  return (
    <div className="audit-filters">
      <label>Action
        <select value={filters.action} onChange={(event) => onFilter("action", event.target.value)}>
          <option value="">All actions</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Actor role
        <select value={filters.role} onChange={(event) => onFilter("role", event.target.value)}>
          <option value="">All roles</option>
          {AUDIT_ACTOR_ROLES.map((role) => <option key={role} value={role}>{role === "admin" ? "Admin" : "Recruiter"}</option>)}
        </select>
      </label>
    </div>
  );
}
