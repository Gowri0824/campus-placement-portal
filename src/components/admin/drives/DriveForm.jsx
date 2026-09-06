import StatusMessage from "../../common/StatusMessage";

function DriveForm({
  companies,
  formData,
  isEditing,
  isLoading,
  isSaving,
  onFieldChange,
  onSubmit,
  onCancel,
}) {
  function handleChange(event) {
    onFieldChange(event.target.name, event.target.value);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.sectionTitle}>
        {isEditing ? "Edit Placement Drive" : "Add Placement Drive"}
      </h2>

      {companies.length === 0 && !isLoading && (
        <StatusMessage type="warning">
          Add a company before creating a placement drive.
        </StatusMessage>
      )}

      <div style={styles.formGrid}>
        <label style={styles.label}>
          Company
          <select
            name="companyId"
            value={formData.companyId}
            onChange={handleChange}
            disabled={isLoading || companies.length === 0}
            required
            style={styles.input}
          >
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Role
          <input
            name="role"
            type="text"
            value={formData.role}
            onChange={handleChange}
            required
            maxLength={120}
            style={styles.input}
            placeholder="Software Engineer"
          />
        </label>

        <label style={styles.label}>
          Minimum CGPA
          <input
            name="minCgpa"
            type="number"
            min="0"
            max="10"
            step="0.01"
            value={formData.minCgpa}
            onChange={handleChange}
            style={styles.input}
            placeholder="7.5"
          />
        </label>

        <label style={styles.label}>
          Allowed Branches
          <input
            name="allowedBranches"
            type="text"
            value={formData.allowedBranches}
            onChange={handleChange}
            maxLength={500}
            style={styles.input}
            placeholder="CSE, IT, ECE"
          />
        </label>

        <label style={styles.label}>
          Package
          <input
            name="packageValue"
            type="text"
            value={formData.packageValue}
            onChange={handleChange}
            maxLength={120}
            style={styles.input}
            placeholder="8 LPA"
          />
        </label>

        <label style={styles.label}>
          Application Deadline
          <input
            name="deadline"
            type="date"
            value={formData.deadline}
            onChange={handleChange}
            style={styles.input}
          />
        </label>
      </div>

      <div style={styles.formActions}>
        <button
          type="submit"
          disabled={isSaving || companies.length === 0}
          style={styles.button}
        >
          {isSaving
            ? "Saving..."
            : isEditing
              ? "Update Drive"
              : "Add Drive"}
        </button>

        {isEditing && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            style={styles.secondaryButton}
          >
            Cancel Edit
          </button>
        )}
      </div>
    </form>
  );
}

const styles = {
  form: {
    display: "grid",
    gap: "16px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px",
    background: "#f9fafb",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  sectionTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "20px",
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
  formActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  button: {
    border: "0",
    borderRadius: "6px",
    padding: "12px 16px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "0",
    borderRadius: "6px",
    padding: "12px 16px",
    background: "#e0ecff",
    color: "#1d4ed8",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
  },
};

export default DriveForm;
