import { formatAllowedBranches } from "../../../utils/branches";
import { formatDeadline } from "../../../utils/dates";
import { styles } from "./driveStyles";

export default function DriveEligibilityInfo({ drive }) {
  return (
    <div style={styles.requirements}>
      <InfoItem
        label="Minimum CGPA"
        value={drive.min_cgpa ?? "Not specified"}
      />
      <InfoItem
        label="Allowed Branches"
        value={formatAllowedBranches(drive.allowed_branches)}
      />
      <InfoItem
        label="Application Deadline"
        value={formatDeadline(drive.deadline)}
      />
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}
