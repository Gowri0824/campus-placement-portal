import { formatDate } from "../../../utils/dates";

function DrivesTable({
  drives,
  isLoading,
  deleteConfirmDriveId,
  deletingDriveId,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}) {
  return (
    <section style={styles.listSection}>
      <h2 style={styles.sectionTitle}>All Placement Drives</h2>

      {isLoading ? (
        <div style={styles.emptyState}>Loading placement drives...</div>
      ) : drives.length === 0 ? (
        <div style={styles.emptyState}>
          No placement drives have been added yet.
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHead}>Company</th>
                <th style={styles.tableHead}>Role</th>
                <th style={styles.tableHead}>Eligibility</th>
                <th style={styles.tableHead}>Package</th>
                <th style={styles.tableHead}>Deadline</th>
                <th style={styles.tableHead}>Added</th>
                <th style={styles.tableHead}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {drives.map((drive) => (
                <tr key={drive.id}>
                  <td style={styles.tableCell}>
                    <strong>{drive.company_name}</strong>
                    {!drive.hasKnownCompany && (
                      <span style={styles.warningText}>
                        Company record not found
                      </span>
                    )}
                  </td>
                  <td style={styles.tableCell}>{drive.role}</td>
                  <td style={styles.tableCell}>
                    <span style={styles.mutedText}>
                      CGPA: {drive.min_cgpa ?? "Not specified"}
                    </span>
                    <span style={styles.mutedText}>
                      Branches: {drive.allowed_branches || "All branches"}
                    </span>
                  </td>
                  <td style={styles.tableCell}>
                    {drive.package || "Not specified"}
                  </td>
                  <td style={styles.tableCell}>
                    {formatDate(drive.deadline, "Not specified")}
                  </td>
                  <td style={styles.tableCell}>
                    {formatDate(drive.created_at, "Not available")}
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.rowActions}>
                      <button
                        type="button"
                        onClick={() => onEdit(drive)}
                        style={styles.smallButton}
                      >
                        Edit
                      </button>

                      {deleteConfirmDriveId === drive.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onDelete(drive.id)}
                            disabled={deletingDriveId === drive.id}
                            style={styles.dangerButton}
                          >
                            {deletingDriveId === drive.id
                              ? "Deleting..."
                              : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={onCancelDelete}
                            style={styles.smallButton}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRequestDelete(drive.id)}
                          style={styles.dangerButton}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const styles = {
  listSection: {
    display: "grid",
    gap: "16px",
    marginTop: "28px",
  },
  sectionTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "20px",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    minWidth: "1100px",
    borderCollapse: "collapse",
    background: "#ffffff",
  },
  tableHead: {
    padding: "14px 16px",
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontSize: "13px",
    textAlign: "left",
    textTransform: "uppercase",
  },
  tableCell: {
    padding: "16px",
    borderBottom: "1px solid #eef2f7",
    color: "#111827",
    fontSize: "15px",
    verticalAlign: "top",
  },
  mutedText: {
    display: "block",
    marginBottom: "4px",
    color: "#4b5563",
    fontSize: "14px",
    lineHeight: 1.4,
  },
  warningText: {
    display: "block",
    marginTop: "6px",
    color: "#b45309",
    fontSize: "13px",
    fontWeight: 600,
  },
  rowActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  smallButton: {
    border: "0",
    borderRadius: "6px",
    padding: "9px 12px",
    background: "#e0ecff",
    color: "#1d4ed8",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  dangerButton: {
    border: "0",
    borderRadius: "6px",
    padding: "9px 12px",
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  emptyState: {
    border: "1px dashed #cbd5e1",
    borderRadius: "8px",
    padding: "24px",
    color: "#4b5563",
    background: "#f8fafc",
    textAlign: "center",
  },
};

export default DrivesTable;
