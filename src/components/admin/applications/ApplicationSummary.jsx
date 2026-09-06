import { styles } from "./applicationStyles";

export default function ApplicationSummary({ counts }) {
  return (
    <section style={styles.summaryBand}>
      <StatusSummary label="All Applications" value={counts.total} />
      <StatusSummary label="Pending" value={counts.pending} />
      <StatusSummary label="Selected" value={counts.selected} />
      <StatusSummary label="Rejected" value={counts.rejected} />
      <StatusSummary label="Withdrawn" value={counts.withdrawn} />
    </section>
  );
}

function StatusSummary({ label, value }) {
  return (
    <div style={styles.summaryItem}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}
