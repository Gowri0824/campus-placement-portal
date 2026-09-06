import StatusMessage from "../../components/common/StatusMessage";
import ApplicationSummary from "../../components/admin/applications/ApplicationSummary";
import ApplicationFilters from "../../components/admin/applications/ApplicationFilters";
import ApplicationsTable from "../../components/admin/applications/ApplicationsTable";
import { styles } from "../../components/admin/applications/applicationStyles";
import { useAdminApplications } from "../../hooks/useAdminApplications";

export default function ApplicationsManagement() {
  const directory = useAdminApplications();

  return (
    <section style={styles.panel}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Admin</p>
          <h1 style={styles.title}>Applications Management</h1>
          <p style={styles.description}>
            Review student applications and maintain selection outcomes.
          </p>
        </div>
      </header>
      <StatusMessage type="error" style={styles.error}>{directory.error}</StatusMessage>
      <StatusMessage type="success" style={styles.success}>{directory.successMessage}</StatusMessage>
      <ApplicationSummary counts={directory.counts} />
      <ApplicationFilters statusFilter={directory.statusFilter} onChange={directory.setStatusFilter} />
      {directory.referenceWarnings.map((warning) => (
        <StatusMessage key={warning} type="warning" style={styles.warning}>
          {warning}
        </StatusMessage>
      ))}
      {directory.isLoading ? (
        <div style={styles.emptyState}>Loading applications...</div>
      ) : directory.applications.length === 0 ? (
        <div style={styles.emptyState}>No student applications are available.</div>
      ) : directory.filteredApplications.length === 0 ? (
        <div style={styles.emptyState}>No applications match the selected status.</div>
      ) : (
        <ApplicationsTable
          applications={directory.filteredApplications}
          statusSelections={directory.statusSelections}
          updatingApplicationId={directory.updatingApplicationId}
          onSelect={directory.handleStatusSelection}
          onUpdate={directory.handleStatusUpdate}
        />
      )}
    </section>
  );
}
