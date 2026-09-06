import { formatDate } from "../../../utils/dates";

function CompaniesTable({
  companies,
  isLoading,
  deleteConfirmCompanyId,
  deletingCompanyId,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}) {
  return (
    <section style={styles.listSection}>
      <h2 style={styles.sectionTitle}>All Companies</h2>

      {isLoading ? (
        <div style={styles.emptyState}>Loading companies...</div>
      ) : companies.length === 0 ? (
        <div style={styles.emptyState}>No companies added yet.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHead}>Company</th>
                <th style={styles.tableHead}>Website</th>
                <th style={styles.tableHead}>Location</th>
                <th style={styles.tableHead}>Added</th>
                <th style={styles.tableHead}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td style={styles.tableCell}>
                    <strong>{company.company_name}</strong>
                    {company.description && (
                      <span style={styles.mutedText}>{company.description}</span>
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.link}
                      >
                        {company.website}
                      </a>
                    ) : (
                      "Not provided"
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {company.location || "Not provided"}
                  </td>
                  <td style={styles.tableCell}>
                    {formatDate(company.created_at)}
                  </td>
                  <td style={styles.tableCell}>
                    <div style={styles.rowActions}>
                      <button
                        type="button"
                        onClick={() => onEdit(company)}
                        style={styles.smallButton}
                      >
                        Edit
                      </button>

                      {deleteConfirmCompanyId === company.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onDelete(company.id)}
                            disabled={deletingCompanyId === company.id}
                            style={styles.dangerButton}
                          >
                            {deletingCompanyId === company.id
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
                          onClick={() => onRequestDelete(company.id)}
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
    minWidth: "860px",
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
    marginTop: "6px",
    color: "#6b7280",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  link: {
    color: "#1d4ed8",
    overflowWrap: "anywhere",
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

export default CompaniesTable;
