import { AUDIT_ACTION_LABELS } from "../../../constants/auditLogs";
import { formatDateTime } from "../../../utils/dates";

export default function AuditLogsTable({ events, filtered }) {
  if (!events.length) return <p>{filtered ? "No audit events match these filters." : "No audit events on this page."}</p>;
  return (
    <div className="audit-table-wrap">
      <table className="audit-table">
        <thead><tr><th>Timestamp (UTC)</th><th>Actor</th><th>Action</th><th>Target</th><th>Status change</th></tr></thead>
        <tbody>{events.map((event) => (
          <tr key={event.id}>
            <td>{formatDateTime(event.created_at)}</td>
            <td>{event.actor_name || "Profile unavailable"}<small>{event.actor_role}</small><code>{event.actor_profile_id}</code></td>
            <td>{AUDIT_ACTION_LABELS[event.action] || event.action}</td>
            <td>{event.entity_type}<code>{event.entity_id}</code>
              {event.metadata?.company_id && <small>Company: {event.metadata.company_id}</small>}
              {event.metadata?.drive_id && <small>Drive: {event.metadata.drive_id}</small>}
            </td>
            <td>{event.old_status && event.new_status ? `${event.old_status} to ${event.new_status}` : "Not applicable"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
