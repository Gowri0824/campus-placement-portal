import { styles } from "./eligibilityStyles";

export default function DriveSelector({ drives, selectedDriveId, onChange, disabled }) {
  return (
    <section style={styles.selectorSection}>
      <label style={styles.label}>
        Placement Drive
        <select
          value={selectedDriveId}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || drives.length === 0}
          style={styles.select}
        >
          <option value="">Select placement drive</option>
          {drives.map((drive) => (
            <option key={drive.id} value={drive.id}>
              {`${drive.company_name} - ${drive.role || "Role not specified"}`}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
