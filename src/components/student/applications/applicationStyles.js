import { getApplicationStatusCategory } from "../../../utils/applicationStatus";

export function getStatusBadgeStyle(status) {
  const category = getApplicationStatusCategory(status);

  if (category === "selected") {
    return { ...styles.statusBadge, ...styles.selectedBadge };
  }

  if (category === "rejected") {
    return { ...styles.statusBadge, ...styles.rejectedBadge };
  }

  if (category === "withdrawn") {
    return { ...styles.statusBadge, ...styles.withdrawnBadge };
  }

  return { ...styles.statusBadge, ...styles.appliedBadge };
}

export const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "32px",
  },
  panel: {
    maxWidth: "1000px",
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #dfe4ea",
    borderRadius: "8px",
    padding: "32px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: "24px",
  },
  headerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontWeight: 700,
    textTransform: "uppercase",
    fontSize: "13px",
  },
  title: {
    margin: "0 0 12px",
    color: "#111827",
    fontSize: "30px",
  },
  description: {
    margin: 0,
    color: "#4b5563",
    fontSize: "16px",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    minWidth: "1040px",
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
  },
  statusBadge: {
    display: "inline-block",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "13px",
    fontWeight: 700,
  },
  appliedBadge: {
    background: "#e0ecff",
    color: "#1d4ed8",
  },
  selectedBadge: {
    background: "#dcfce7",
    color: "#166534",
  },
  rejectedBadge: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  withdrawnBadge: {
    background: "#e5e7eb",
    color: "#374151",
  },
  withdrawButton: {
    minHeight: "40px",
    border: "1px solid #dc2626",
    borderRadius: "6px",
    padding: "9px 12px",
    background: "#ffffff",
    color: "#b91c1c",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  reapplyButton: {
    minHeight: "40px",
    border: 0,
    borderRadius: "6px",
    padding: "9px 12px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  deadlineClosedText: {
    color: "#b45309",
    fontSize: "14px",
    fontWeight: 600,
  },
  unavailableText: {
    color: "#6b7280",
    fontSize: "14px",
  },
  secondaryButton: {
    borderRadius: "6px",
    padding: "10px 14px",
    background: "#e0ecff",
    color: "#1d4ed8",
    fontSize: "14px",
    fontWeight: 700,
    textDecoration: "none",
  },
  emptyState: {
    border: "1px dashed #cbd5e1",
    borderRadius: "8px",
    padding: "24px",
    color: "#4b5563",
    background: "#f8fafc",
    textAlign: "center",
  },
  error: {
    marginBottom: "16px",
    borderRadius: "6px",
    padding: "12px",
    background: "#fee2e2",
    color: "#991b1b",
  },
  success: {
    marginBottom: "16px",
    borderRadius: "6px",
    padding: "12px",
    background: "#dcfce7",
    color: "#166534",
  },
};
