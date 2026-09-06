import DriveEligibilityInfo from "./DriveEligibilityInfo";
import ApplyAction from "./ApplyAction";
import { styles } from "./driveStyles";

export default function DriveCard({ drive, state, applyingDriveId, onApply }) {
  const { isEligible } = state;
  return (
    <article style={styles.driveCard}>
      <div style={styles.cardHeader}>
        <div>
          <h2 style={styles.companyName}>
            {drive.companies?.company_name || "Company"}
          </h2>
          <p style={styles.role}>{drive.role || "Role not set"}</p>
        </div>

        <span
          style={
            isEligible ? styles.eligibleBadge : styles.blockedBadge
          }
        >
          {isEligible ? "Eligible" : "Not Eligible"}
        </span>
      </div>

      <DriveEligibilityInfo drive={drive} />

      <ApplyAction drive={drive} state={state} applyingDriveId={applyingDriveId} onApply={onApply} />
    </article>
  );
}
