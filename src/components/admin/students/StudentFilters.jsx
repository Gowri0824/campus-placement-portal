function StudentFilters({
  searchTerm,
  branchFilter,
  graduationYearFilter,
  minimumCgpaFilter,
  branches,
  graduationYears,
  onSearchChange,
  onBranchChange,
  onGraduationYearChange,
  onMinimumCgpaChange,
  onClear,
}) {
  return (
    <section style={styles.filters}>
      <label style={styles.label}>
        Search Students
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          style={styles.input}
          placeholder="Name, email, or roll number"
        />
      </label>

      <label style={styles.label}>
        Branch
        <select
          value={branchFilter}
          onChange={(event) => onBranchChange(event.target.value)}
          style={styles.input}
        >
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.value} value={branch.value}>
              {branch.label}
            </option>
          ))}
        </select>
      </label>

      <label style={styles.label}>
        Graduation Year
        <select
          value={graduationYearFilter}
          onChange={(event) => onGraduationYearChange(event.target.value)}
          style={styles.input}
        >
          <option value="">All years</option>
          {graduationYears.map((graduationYear) => (
            <option key={graduationYear} value={graduationYear}>
              {graduationYear}
            </option>
          ))}
        </select>
      </label>

      <label style={styles.label}>
        Minimum CGPA
        <input
          type="number"
          min="0"
          max="10"
          step="0.01"
          value={minimumCgpaFilter}
          onChange={(event) => onMinimumCgpaChange(event.target.value)}
          style={styles.input}
          placeholder="0.00"
        />
      </label>

      <button type="button" onClick={onClear} style={styles.button}>
        Clear Filters
      </button>
    </section>
  );
}

const styles = {
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    alignItems: "end",
    marginBottom: "20px",
  },
  label: {
    display: "grid",
    gap: "8px",
    color: "#1f2937",
    fontWeight: 600,
  },
  input: {
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
  button: {
    minHeight: "44px",
    border: "0",
    borderRadius: "6px",
    padding: "10px 14px",
    background: "#e0ecff",
    color: "#1d4ed8",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};

export default StudentFilters;
