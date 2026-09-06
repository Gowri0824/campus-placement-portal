import { styles } from "./profileStyles";

export default function ProfileForm({ formData, isSaving, handleChange, handleSubmit }) {
  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.sectionTitle}>Edit Placement Details</h2>

      <div style={styles.formGrid}>
        <label style={styles.label}>
          Branch
          <input
            name="branch"
            type="text"
            value={formData.branch}
            onChange={handleChange}
            style={styles.input}
            placeholder="Computer Science"
          />
        </label>

        <label style={styles.label}>
          CGPA
          <input
            name="cgpa"
            type="number"
            min="0"
            max="10"
            step="0.01"
            value={formData.cgpa}
            onChange={handleChange}
            style={styles.input}
            placeholder="8.5"
          />
        </label>

        <label style={styles.label}>
          Graduation Year
          <input
            name="graduationYear"
            type="number"
            value={formData.graduationYear}
            onChange={handleChange}
            style={styles.input}
            placeholder="2026"
          />
        </label>
      </div>

      <label style={styles.label}>
        Skills
        <textarea
          name="skills"
          value={formData.skills}
          onChange={handleChange}
          style={styles.textarea}
          placeholder="React, JavaScript, SQL, Communication"
        />
      </label>

      <button type="submit" disabled={isSaving} style={styles.button}>
        {isSaving ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
