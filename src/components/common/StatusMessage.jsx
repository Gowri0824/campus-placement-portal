function StatusMessage({ type, children, style }) {
  if (!children) {
    return null;
  }

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      style={{ ...styles[type], ...style }}
    >
      {children}
    </div>
  );
}

const styles = {
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
    borderRadius: "6px",
    padding: "12px",
    background: "#fef3c7",
    color: "#92400e",
  },
};

export default StatusMessage;
