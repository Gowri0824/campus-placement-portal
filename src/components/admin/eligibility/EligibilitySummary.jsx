import { formatAllowedBranches } from "../../../utils/branches";
import { styles } from "./eligibilityStyles";

export default function EligibilitySummary({ drive, count }) {
  return (
    <section style={styles.criteriaBand}>
      <div>
        <span style={styles.criteriaLabel}>Company</span>
        <strong style={styles.criteriaValue}>
          {drive.company_name}
        </strong>
      </div>
      <div>
        <span style={styles.criteriaLabel}>Role</span>
        <strong style={styles.criteriaValue}>
          {drive.role || "Not specified"}
        </strong>
      </div>
      <div>
        <span style={styles.criteriaLabel}>Minimum CGPA</span>
        <strong style={styles.criteriaValue}>
          {drive.min_cgpa ?? "No restriction"}
        </strong>
      </div>
      <div>
        <span style={styles.criteriaLabel}>Allowed Branches</span>
        <strong style={styles.criteriaValue}>
          {formatAllowedBranches(drive.allowed_branches)}
        </strong>
      </div>
      <div style={styles.countBlock}>
        <span style={styles.criteriaLabel}>Eligible Students</span>
        <strong style={styles.count}>{count}</strong>
      </div>
    </section>
  );
}
