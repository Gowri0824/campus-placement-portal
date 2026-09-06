function CompanyForm({
  formData,
  isEditing,
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
        {isEditing ? "Edit Company" : "Add Company"}
      </h2>

      <div style={styles.formGrid}>
        <label style={styles.label}>
          Company Name
          <input
            name="companyName"
            type="text"
            value={formData.companyName}
            onChange={handleChange}
            style={styles.input}
            placeholder="Tata Consultancy Services"
          />
        </label>

        <label style={styles.label}>
          Website
          <input
            name="website"
            type="url"
            value={formData.website}
            onChange={handleChange}
            style={styles.input}
            placeholder="https://www.example.com"
          />
        </label>

        <label style={styles.label}>
          Location
          <input
            name="location"
            type="text"
            value={formData.location}
            onChange={handleChange}
            style={styles.input}
            placeholder="Mumbai"
          />
        </label>
      </div>

      <label style={styles.label}>
        Description
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          style={styles.textarea}
          placeholder="Short company overview"
        />
      </label>

      <div style={styles.formActions}>
        <button type="submit" disabled={isSaving} style={styles.button}>
          {isSaving
            ? "Saving..."
            : isEditing
              ? "Update Company"
              : "Add Company"}
        </button>

        {isEditing && (
          <button type="button" onClick={onCancel} style={styles.secondaryButton}>
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
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "15px",
  },
  textarea: {
    width: "100%",
    minHeight: "96px",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "15px",
    fontFamily: "inherit",
    resize: "vertical",
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

export default CompanyForm;
