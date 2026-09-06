import { getApplicationStatusCategory as getStatusCategory } from "../../../utils/applicationStatus";

export function getStatusBadgeStyle(status) {
  const category = getStatusCategory(status);

  if (category === "selected") {
    return { ...styles.statusBadge, ...styles.selectedBadge };
  }

  if (category === "rejected") {
    return { ...styles.statusBadge, ...styles.rejectedBadge };
  }

  if (category === "withdrawn") {
    return { ...styles.statusBadge, ...styles.withdrawnBadge };
  }

  return { ...styles.statusBadge, ...styles.pendingBadge };
}

export const styles = {
  panel: {
    maxWidth: "1220px",
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #dfe4ea",
    borderRadius: "8px",
    padding: "32px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
  },
  header: {
    marginBottom: "24px",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
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
  summaryBand: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
    marginBottom: "22px",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
    padding: "18px 0",
  },
  summaryItem: {
    borderLeft: "3px solid #2563eb",
    paddingLeft: "14px",
  },
  summaryLabel: {
    display: "block",
    marginBottom: "6px",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#111827",
    fontSize: "26px",
    lineHeight: 1,
  },
  filterRow: {
    maxWidth: "320px",
    marginBottom: "20px",
  },
  label: {
    display: "grid",
    gap: "8px",
    color: "#1f2937",
    fontWeight: 600,
  },
  filterSelect: {
    width: "100%",
    minHeight: "44px",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "10px 12px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "15px",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    minWidth: "1180px",
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
    lineHeight: 1.5,
    verticalAlign: "top",
  },
  mutedText: {
    display: "block",
    marginTop: "5px",
    color: "#6b7280",
    fontSize: "14px",
  },
  warningText: {
    display: "block",
    marginTop: "5px",
    color: "#b45309",
    fontSize: "13px",
    fontWeight: 600,
  },
  statusBadge: {
    display: "inline-block",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "13px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  pendingBadge: {
    background: "#fef3c7",
    color: "#92400e",
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
  updateControls: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  statusSelect: {
    minWidth: "150px",
    minHeight: "40px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "8px 10px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "14px",
  },
  button: {
    minHeight: "40px",
    border: "0",
    borderRadius: "6px",
    padding: "9px 12px",
    background: "#2563eb",
    color: "#ffffff",
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
  warning: {
    marginBottom: "16px",
    borderRadius: "6px",
    padding: "12px",
    background: "#fef3c7",
    color: "#92400e",
  },
};
