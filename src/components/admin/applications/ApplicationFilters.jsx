import { styles } from "./applicationStyles";

export default function ApplicationFilters({ statusFilter, onChange }) {
  return (
    <div style={styles.filterRow}>
      <label style={styles.label}>
        Filter by Status
        <select
          value={statusFilter}
          onChange={(event) => onChange(event.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All applications</option>
          <option value="pending">Pending</option>
          <option value="selected">Selected</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </label>
    </div>
  );
}
