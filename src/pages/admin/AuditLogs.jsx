import { useAuditLogs } from "../../hooks/useAuditLogs";
import StatusMessage from "../../components/common/StatusMessage";
import AuditLogFilters from "../../components/admin/audit/AuditLogFilters";
import AuditLogsTable from "../../components/admin/audit/AuditLogsTable";
import "../../styles/auditLogs.css";

export default function AuditLogs() {
  const audit = useAuditLogs();
  return (
    <section className="audit-logs">
      <header><h1>Audit Logs</h1><button type="button" onClick={audit.refresh} disabled={audit.isLoading}>
        {audit.error ? "Retry" : "Refresh"}
      </button></header>
      <AuditLogFilters filters={audit.filters} onFilter={audit.setFilter} />
      <StatusMessage type="error">{audit.error}</StatusMessage>
      <StatusMessage type="warning">{audit.warning}</StatusMessage>
      {audit.isLoading ? <p role="status">Loading audit logs...</p> : !audit.error && (
        <AuditLogsTable events={audit.events} filtered={Boolean(audit.filters.action || audit.filters.role)} />
      )}
      <nav className="audit-pagination" aria-label="Audit log pages">
        <button type="button" onClick={audit.previousPage} disabled={audit.isLoading || audit.filters.page === 0}>Previous</button>
        <span>Page {audit.filters.page + 1}</span>
        <button type="button" onClick={audit.nextPage} disabled={audit.isLoading || !audit.hasNext}>Next</button>
      </nav>
    </section>
  );
}
